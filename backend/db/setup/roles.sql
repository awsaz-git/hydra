-- Sets up Hydra's database roles. Not a migration: run it once per Neon branch
-- (production and staging), connected to the "hydra" database AS hydra_owner.
-- Safe to run again. It holds no passwords (see the end of this file).
--
--   hydra_owner  Neon's default role for this project (created with the project, so it is
--                also the admin). Owns the tables and runs the migrations (go run . migrate).
--                Its password never goes into the running backend.
--   hydra_app    what the running backend uses: read and write rows, nothing else.
--
-- hydra_app is created here with SQL on purpose: roles made in the Neon console join
-- neon_superuser, which can bypass row-level security.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hydra_app') THEN
        CREATE ROLE hydra_app LOGIN;
    END IF;
END
$$;

-- Only our two roles may connect to this database.
REVOKE ALL ON DATABASE hydra FROM PUBLIC;
GRANT CONNECT ON DATABASE hydra TO hydra_owner, hydra_app;

-- Our tables live in the "public" schema. hydra_owner may create objects there;
-- hydra_app may only use what exists.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO hydra_owner;
GRANT USAGE ON SCHEMA public TO hydra_app;

-- Every table or sequence hydra_owner creates from now on is automatically usable by
-- hydra_app for rows only (no TRUNCATE, no ALTER, no DROP). A migration can still take
-- rights away from a single table (e.g. the read-only exercise catalog).
ALTER DEFAULT PRIVILEGES FOR ROLE hydra_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hydra_app;
ALTER DEFAULT PRIVILEGES FOR ROLE hydra_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO hydra_app;

-- Functions are not callable by everyone by default; each one is granted on purpose.
ALTER DEFAULT PRIVILEGES FOR ROLE hydra_owner IN SCHEMA public
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Safety limits for the backend's role:
--   statement_timeout                    a runaway query is stopped after 15 s
--   idle_in_transaction_session_timeout  a transaction left open (e.g. by a bug) is closed after 30 s
--   CONNECTION LIMIT                     at most 20 connections at once
ALTER ROLE hydra_app SET statement_timeout = '15s';
ALTER ROLE hydra_app SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE hydra_app CONNECTION LIMIT 20;

-- Password: Neon only accepts plain-text passwords (psql's \password doesn't work).
-- In psql, first stop lines that start with a space from being saved to history:
--     \set HISTCONTROL ignorespace
-- then type this line WITH a leading space, using a password from `openssl rand -hex 24`:
--      ALTER ROLE hydra_app PASSWORD 'PASTE_PASSWORD_HERE';
