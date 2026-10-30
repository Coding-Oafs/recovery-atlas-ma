CREATE TABLE IF NOT EXISTS atlas_message_read (
 user_id text NOT NULL REFERENCES atlas_user(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES atlas_conversation(id) ON DELETE CASCADE,
 last_message_id bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,conversation_id)
);
