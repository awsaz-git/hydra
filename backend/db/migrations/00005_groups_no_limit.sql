-- Athlete groups: no limit of 3 any more; pick as many as apply (owner, 2026-11-07).
-- 7 is the number of groups, and Go refuses duplicates, so it's the most anyone can pick.
-- Never edit this file once it has run on staging or production; add a new migration instead.

-- +goose Up

ALTER TABLE profiles DROP CONSTRAINT profiles_athlete_groups_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_athlete_groups_check CHECK (
    jsonb_typeof(athlete_groups) = 'array'
    AND jsonb_array_length(athlete_groups) BETWEEN 1 AND 7
    AND athlete_groups <@ '["strength", "physique", "functional", "endurance", "sport", "combat", "general"]'::jsonb
);

-- +goose Down

-- Back to at most 3: keep the main group (when set) and the first others, in their order.
UPDATE profiles
SET athlete_groups = (
    SELECT jsonb_agg(kept.g ORDER BY kept.i)
    FROM (
        SELECT e.g, e.i
        FROM jsonb_array_elements(athlete_groups) WITH ORDINALITY AS e(g, i)
        ORDER BY COALESCE(e.g #>> '{}' = main_group, false) DESC, e.i
        LIMIT 3
    ) AS kept
)
WHERE jsonb_array_length(athlete_groups) > 3;

ALTER TABLE profiles DROP CONSTRAINT profiles_athlete_groups_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_athlete_groups_check CHECK (
    jsonb_typeof(athlete_groups) = 'array'
    AND jsonb_array_length(athlete_groups) BETWEEN 1 AND 3
    AND athlete_groups <@ '["strength", "physique", "functional", "endurance", "sport", "combat", "general"]'::jsonb
);
