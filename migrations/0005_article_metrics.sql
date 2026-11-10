-- Additive article interaction counters. Existing article rows and engagement records are preserved.
-- Production already has article_views(article_id, visitor_id, view_date) and
-- article_likes(article_id, visitor_id); the Worker reuses those tables.

CREATE TABLE IF NOT EXISTS article_metrics (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_shares (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, reader_id)
);

-- Initialize the new counters from existing production engagement data.
INSERT OR IGNORE INTO article_metrics (article_id, views, likes)
SELECT a.id,
       COALESCE(v.total, 0),
       COALESCE(l.total, 0)
FROM articles AS a
LEFT JOIN (
  SELECT article_id, COUNT(*) AS total
  FROM article_views
  GROUP BY article_id
) AS v ON v.article_id = a.id
LEFT JOIN (
  SELECT article_id, COUNT(*) AS total
  FROM article_likes
  GROUP BY article_id
) AS l ON l.article_id = a.id;

CREATE INDEX IF NOT EXISTS idx_article_metrics_views ON article_metrics(views DESC);
CREATE INDEX IF NOT EXISTS idx_article_metrics_likes ON article_metrics(likes DESC);
CREATE INDEX IF NOT EXISTS idx_article_metrics_shares ON article_metrics(shares DESC);
