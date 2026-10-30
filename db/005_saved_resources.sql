CREATE TABLE IF NOT EXISTS atlas_saved_resource (
 user_id text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
 saved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,resource_id)
);
CREATE TABLE IF NOT EXISTS atlas_recovery (
 user_id text PRIMARY KEY REFERENCES atlas_user(id) ON DELETE CASCADE,
 code_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atlas_saved_resource_user_date_idx ON atlas_saved_resource(user_id,saved_at DESC);
