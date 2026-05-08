CREATE TABLE IF NOT EXISTS chat_sessions (
  session_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
  ON chat_sessions (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

INSERT INTO chat_sessions (session_key, user_id, title, created_at, updated_at)
SELECT
  cm.session_key,
  cm.user_id,
  LEFT(COALESCE((ARRAY_AGG(cm.content ORDER BY cm.created_at ASC) FILTER (WHERE cm.role = 'user'))[1], 'Nueva conversación'), 80),
  MIN(cm.created_at),
  MAX(cm.created_at)
FROM chat_messages cm
GROUP BY cm.session_key, cm.user_id
ON CONFLICT (session_key) DO NOTHING;

UPDATE chat_sessions
SET title = COALESCE(NULLIF(title, ''), 'Nueva conversación');
