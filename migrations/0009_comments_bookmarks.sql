-- Add anonymous saved-article tracking without changing historical engagement metrics.
CREATE TABLE IF NOT EXISTS article_bookmarks (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, visitor_id)
);
CREATE INDEX IF NOT EXISTS idx_article_comments_status_created ON article_comments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_article_comments_article_status ON article_comments(article_id, status);
CREATE INDEX IF NOT EXISTS idx_article_bookmarks_article ON article_bookmarks(article_id);
