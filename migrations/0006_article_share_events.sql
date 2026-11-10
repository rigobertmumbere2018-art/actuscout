-- Record every successful share action. Keep article_shares from migration 0005
-- untouched for compatibility with any existing data.
CREATE TABLE IF NOT EXISTS article_share_events (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_article_share_events_article_created
  ON article_share_events(article_id, created_at DESC);
