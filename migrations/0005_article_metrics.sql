-- Additive article interaction counters. Existing article rows are preserved.
CREATE TABLE IF NOT EXISTS article_metrics (
  article_id TEXT PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  shares INTEGER NOT NULL DEFAULT 0 CHECK (shares >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_reads (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, reader_id)
);

CREATE TABLE IF NOT EXISTS article_likes (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, reader_id)
);

CREATE TABLE IF NOT EXISTS article_shares (
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reader_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, reader_id)
);

CREATE INDEX IF NOT EXISTS idx_article_metrics_views ON article_metrics(views DESC);
CREATE INDEX IF NOT EXISTS idx_article_metrics_likes ON article_metrics(likes DESC);
CREATE INDEX IF NOT EXISTS idx_article_metrics_shares ON article_metrics(shares DESC);
