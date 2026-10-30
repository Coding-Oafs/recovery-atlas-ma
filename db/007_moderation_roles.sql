CREATE TABLE IF NOT EXISTS atlas_community_role (
 user_id text PRIMARY KEY REFERENCES atlas_user(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('moderator')),
 contact_email text,
 granted_at timestamptz NOT NULL DEFAULT now()
);
