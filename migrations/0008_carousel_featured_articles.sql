CREATE TABLE IF NOT EXISTS carousel_slides (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 subtitle TEXT DEFAULT '',
 image_url TEXT NOT NULL,
 link_url TEXT DEFAULT '',
 position INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'published',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_carousel_status_position ON carousel_slides(status, position);
CREATE TABLE IF NOT EXISTS featured_articles (
 article_id TEXT PRIMARY KEY,
 position INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_featured_position ON featured_articles(position);
