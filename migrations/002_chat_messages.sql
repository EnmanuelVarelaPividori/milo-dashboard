CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  session_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_key_created_at_idx
  ON chat_messages (session_key, created_at ASC);
