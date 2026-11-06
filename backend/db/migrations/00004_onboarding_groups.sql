-- Onboarding changes (owner, 2026-11-07):
--   - the main focus is no longer asked in onboarding: main_group becomes optional (it's set later,
--     from settings or by the coach);
--   - "tactical" is removed from the athlete groups;
--   - "hybrid" is renamed "functional" (picking several groups is what makes someone hybrid).
-- Never edit this file once it has run on staging or production; add a new migration instead.

-- +goose Up

ALTER TABLE profiles ALTER COLUMN main_group DROP NOT NULL;

-- The CHECKs name the groups, so they come off before the data changes and go back on after.
-- (00003's main-group check uses two columns, so Postgres named it "profiles_check"; the new one
-- gets an explicit name.)
ALTER TABLE profiles DROP CONSTRAINT profiles_athlete_groups_check;
ALTER TABLE profiles DROP CONSTRAINT profiles_check;

-- hybrid → functional (in the list and as the main group).
UPDATE profiles
SET athlete_groups = (athlete_groups - 'hybrid') || '["functional"]'::jsonb
WHERE athlete_groups ? 'hybrid';
UPDATE profiles SET main_group = 'functional' WHERE main_group = 'hybrid';

-- tactical goes. A profile whose only group was tactical gets "general" (at least one is required).
UPDATE profiles SET athlete_groups = athlete_groups - 'tactical' WHERE athlete_groups ? 'tactical';
UPDATE profiles SET athlete_groups = '["general"]'::jsonb WHERE jsonb_array_length(athlete_groups) = 0;
UPDATE profiles SET main_group = NULL WHERE main_group = 'tactical';

ALTER TABLE profiles ADD CONSTRAINT profiles_athlete_groups_check CHECK (
    jsonb_typeof(athlete_groups) = 'array'
    AND jsonb_array_length(athlete_groups) BETWEEN 1 AND 3
    AND athlete_groups <@ '["strength", "physique", "functional", "endurance", "sport", "combat", "general"]'::jsonb
);
-- When it's set, the main group must be one of the user's groups (NULL passes).
ALTER TABLE profiles ADD CONSTRAINT profiles_main_group_check CHECK (athlete_groups ? main_group);

-- +goose Down

ALTER TABLE profiles DROP CONSTRAINT profiles_athlete_groups_check;
ALTER TABLE profiles DROP CONSTRAINT profiles_main_group_check;

UPDATE profiles
SET athlete_groups = (athlete_groups - 'functional') || '["hybrid"]'::jsonb
WHERE athlete_groups ? 'functional';
UPDATE profiles SET main_group = 'hybrid' WHERE main_group = 'functional';
-- main_group was required before: use the first group where it's empty.
UPDATE profiles SET main_group = athlete_groups ->> 0 WHERE main_group IS NULL;
ALTER TABLE profiles ALTER COLUMN main_group SET NOT NULL;

ALTER TABLE profiles ADD CONSTRAINT profiles_athlete_groups_check CHECK (
    jsonb_typeof(athlete_groups) = 'array'
    AND jsonb_array_length(athlete_groups) BETWEEN 1 AND 3
    AND athlete_groups <@ '["strength", "physique", "endurance", "hybrid", "sport", "combat", "tactical", "general"]'::jsonb
);
ALTER TABLE profiles ADD CONSTRAINT profiles_check CHECK (athlete_groups ? main_group); -- 00003's name
