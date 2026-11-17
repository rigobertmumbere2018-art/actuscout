CREATE TABLE IF NOT EXISTS chronicles (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chronicles_scheduled_at ON chronicles(scheduled_at);
