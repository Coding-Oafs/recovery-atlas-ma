CREATE TABLE IF NOT EXISTS atlas_profile (
 user_id text PRIMARY KEY REFERENCES atlas_user(id) ON DELETE CASCADE,
 handle text NOT NULL UNIQUE CHECK(handle ~ '^[a-z0-9_]{3,30}$'),
 display_name text NOT NULL CHECK(length(display_name) BETWEEN 2 AND 60),
 bio text NOT NULL DEFAULT '' CHECK(length(bio)<=500),
 region text NOT NULL DEFAULT '' CHECK(length(region)<=80),
 languages text[] NOT NULL DEFAULT ARRAY['English'],
 discoverable boolean NOT NULL DEFAULT false,
 accepts_requests boolean NOT NULL DEFAULT false,
 adult_confirmed boolean NOT NULL DEFAULT false,
 guidelines_at timestamptz,
 suspended boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS atlas_conversation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 requester text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 recipient text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(requester<>recipient)
);
CREATE UNIQUE INDEX IF NOT EXISTS atlas_conversation_pair_idx ON atlas_conversation(LEAST(requester,recipient),GREATEST(requester,recipient));
CREATE INDEX IF NOT EXISTS atlas_conversation_requester_idx ON atlas_conversation(requester,updated_at DESC);
CREATE INDEX IF NOT EXISTS atlas_conversation_recipient_idx ON atlas_conversation(recipient,updated_at DESC);
CREATE TABLE IF NOT EXISTS atlas_message (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 conversation_id uuid NOT NULL REFERENCES atlas_conversation(id) ON DELETE CASCADE,
 sender_id text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 body_encrypted text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atlas_message_thread_idx ON atlas_message(conversation_id,id DESC);
CREATE INDEX IF NOT EXISTS atlas_message_sender_date_idx ON atlas_message(sender_id,created_at);
CREATE TABLE IF NOT EXISTS atlas_block (
 blocker text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 blocked text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(blocker,blocked),CHECK(blocker<>blocked)
);
CREATE TABLE IF NOT EXISTS atlas_community_report (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),reporter_id text REFERENCES atlas_user(id) ON DELETE SET NULL,
 subject_id text REFERENCES atlas_user(id) ON DELETE SET NULL,
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 1000),
 evidence_encrypted text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS atlas_quality_proposal (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
 submitted_by text REFERENCES atlas_user(id) ON DELETE SET NULL,
 source text NOT NULL,proposal jsonb NOT NULL,before_data jsonb,reason text NOT NULL,
 fingerprint text NOT NULL UNIQUE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','dismissed','conflict')),
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS atlas_quality_pending_idx ON atlas_quality_proposal(created_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS atlas_provider_claim (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
 role text NOT NULL,evidence_url text NOT NULL,notes text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,UNIQUE(user_id,resource_id)
);
CREATE INDEX IF NOT EXISTS atlas_resources_url_idx ON resources((data->>'sourceUrl')) WHERE published;
CREATE TABLE IF NOT EXISTS atlas_saved_collection (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 60),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,name)
);
ALTER TABLE atlas_saved_resource ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES atlas_saved_collection(id) ON DELETE SET NULL;
