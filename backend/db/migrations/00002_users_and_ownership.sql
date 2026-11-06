-- Accounts and data ownership: who a request belongs to, and that it only reaches its own rows.
--   users           our own user ID for each Clerk account (no email or name: those stay at Clerk)
--   user_id         on every user-owned table, child tables too (D5), with row-level security (D16)
--   rate_limits     per-user request counters; the backend can't read or change them directly
-- Never edit this file once it has run on staging or production; add a new migration instead.

-- +goose Up

-- The chats so far were test data (D3). Deleting them lets user_id be NOT NULL from the start.
DELETE FROM conversations; -- their messages go with them (ON DELETE CASCADE)

CREATE TABLE users (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id   text        NOT NULL UNIQUE CHECK (clerk_id ~ '^user_[A-Za-z0-9]+$'),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations
    ADD COLUMN user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- lets messages point at (conversation, owner) together, below
    ADD CONSTRAINT conversations_id_user_id_key UNIQUE (id, user_id);

-- The sidebar query: one user's chats, newest activity first.
CREATE INDEX idx_conversations_user_id_updated_at ON conversations (user_id, updated_at DESC);

-- A message's owner must be its conversation's owner. The two-column foreign key makes
-- Postgres enforce that, so the copied user_id (D5) can never disagree with the chat's.
ALTER TABLE messages
    ADD COLUMN user_id uuid NOT NULL,
    DROP CONSTRAINT messages_conversation_id_fkey,
    ADD CONSTRAINT messages_conversation_owner_fkey FOREIGN KEY (conversation_id, user_id)
        REFERENCES conversations (id, user_id) ON DELETE CASCADE;

CREATE INDEX idx_messages_user_id ON messages (user_id);

-- Row-level security: hydra_app only sees and writes rows of the user set for the current
-- transaction (db.AsUser runs set_config('app.user_id', ..., true)). With no user set, nothing
-- matches. NULLIF: after a transaction-local setting ends, Postgres reads it as '' (not NULL),
-- and ''::uuid would be an error instead of "no rows".
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_row ON users
    USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY conversations_own_rows ON conversations
    USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
CREATE POLICY messages_own_rows ON messages
    USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
    WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Users are only ever created by hydra_user_for_clerk below. hydra_app may read and delete
-- its own row (account deletion), nothing else.
REVOKE INSERT, UPDATE ON users FROM hydra_app;

-- The only lookup the auth middleware needs (FEATURE-PLAN 11.2): our user ID for a Clerk ID,
-- creating the user on their first request. SECURITY DEFINER runs it as its owner (hydra_owner),
-- so it works before app.user_id is known. The pinned search_path stops anyone from slipping in
-- a table or function with the same name. It returns the ID and nothing else.
-- +goose StatementBegin
CREATE FUNCTION hydra_user_for_clerk(p_clerk_id text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
    v_id uuid;
BEGIN
    SELECT id INTO v_id FROM public.users WHERE clerk_id = p_clerk_id;
    IF v_id IS NULL THEN
        -- Two first requests at once: one insert wins, the other does nothing and reads it.
        INSERT INTO public.users (clerk_id) VALUES (p_clerk_id) ON CONFLICT (clerk_id) DO NOTHING;
        SELECT id INTO v_id FROM public.users WHERE clerk_id = p_clerk_id;
    END IF;
    RETURN v_id;
END;
$$;
-- +goose StatementEnd

REVOKE ALL ON FUNCTION hydra_user_for_clerk(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hydra_user_for_clerk(text) TO hydra_app;

-- Rate limits (ENGINEERING.md → API access rules). In the database so both backend replicas
-- share one count. A fixed window: one row per user and bucket, reset when the window is over,
-- so the table never grows past users × buckets.
CREATE TABLE rate_limits (
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    bucket       text        NOT NULL CHECK (bucket IN ('api', 'chat')),
    window_start timestamptz NOT NULL,
    hits         integer     NOT NULL CHECK (hits > 0),
    PRIMARY KEY (user_id, bucket)
);

-- Nobody but the function below touches it: no rights for hydra_app, and RLS with no policy
-- as a second lock (the owner, who runs the function, isn't subject to RLS).
REVOKE ALL ON rate_limits FROM hydra_app;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Counts one request and returns 0 if it's allowed, or the seconds until the window resets
-- if the user is over p_limit. One atomic upsert, so concurrent requests can't both slip in.
-- +goose StatementBegin
CREATE FUNCTION hydra_rate_limit_hit(p_user_id uuid, p_bucket text, p_limit integer, p_window_seconds integer)
    RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
    v_window interval := make_interval(secs => p_window_seconds);
    v_hits   integer;
    v_start  timestamptz;
BEGIN
    INSERT INTO public.rate_limits AS r (user_id, bucket, window_start, hits)
    VALUES (p_user_id, p_bucket, now(), 1)
    ON CONFLICT (user_id, bucket) DO UPDATE SET
        window_start = CASE WHEN r.window_start <= now() - v_window THEN now() ELSE r.window_start END,
        hits         = CASE WHEN r.window_start <= now() - v_window THEN 1 ELSE r.hits + 1 END
    RETURNING hits, window_start INTO v_hits, v_start;

    IF v_hits <= p_limit THEN
        RETURN 0;
    END IF;
    RETURN GREATEST(1, ceil(extract(epoch FROM v_start + v_window - now()))::integer);
END;
$$;
-- +goose StatementEnd

REVOKE ALL ON FUNCTION hydra_rate_limit_hit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hydra_rate_limit_hit(uuid, text, integer, integer) TO hydra_app;

-- +goose Down

DROP FUNCTION hydra_rate_limit_hit(uuid, text, integer, integer);
DROP TABLE rate_limits;
DROP FUNCTION hydra_user_for_clerk(text);

-- Policies first: Postgres won't drop a column a policy uses.
DROP POLICY messages_own_rows ON messages;
DROP POLICY conversations_own_rows ON conversations;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

ALTER TABLE messages
    DROP CONSTRAINT messages_conversation_owner_fkey,
    DROP COLUMN user_id, -- also drops idx_messages_user_id
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id)
        REFERENCES conversations (id) ON DELETE CASCADE;
ALTER TABLE conversations
    DROP CONSTRAINT conversations_id_user_id_key,
    DROP COLUMN user_id; -- also drops idx_conversations_user_id_updated_at

DROP TABLE users; -- and its policy
