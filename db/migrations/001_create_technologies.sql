-- Create the technologies table and its enum types.
-- Safe to run more than once: every statement is guarded.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'technology_type') THEN
    CREATE TYPE technology_type AS ENUM ('Datastores', 'Data Management', 'Infrastructure', 'Language');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'technology_status') THEN
    CREATE TYPE technology_status AS ENUM ('ADOPT', 'TRIAL', 'ASSESS', 'HOLD');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'technology_trend') THEN
    CREATE TYPE technology_trend AS ENUM ('moved up', 'moved down', 'new', 'no change');
  END IF;
END
$$;

-- `number` is an identity column: values are assigned as max + 1 (1, 2, 3...)
-- and a sequence never hands out the same value twice, even after a delete.
CREATE TABLE IF NOT EXISTS technologies (
  number integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 280),
  type technology_type NOT NULL,
  status technology_status NOT NULL,
  trend technology_trend NOT NULL
);
