-- Snapshot en lecture seule du schéma D1 de production ActuScout
-- Capturé le 2026-11-09 depuis actuscout-db.
-- NE PAS exécuter ce fichier sur la base : il décrit l'état existant.
-- Les données, identifiants et contenus ne sont pas inclus.

CREATE TABLE album_photos (
  id TEXT PRIMARY KEY, album_id TEXT NOT NULL, object_key TEXT NOT NULL, public_url TEXT DEFAULT '',
  mime_type TEXT DEFAULT '', google_media_id TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE TABLE albums (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', event_date TEXT DEFAULT '',
  source_url TEXT DEFAULT '', cover_url TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_likes (
  article_id TEXT NOT NULL, visitor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(article_id, visitor_id)
);

CREATE TABLE article_views (
  article_id TEXT NOT NULL, visitor_id TEXT NOT NULL, view_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(article_id, visitor_id, view_date)
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT '', excerpt TEXT DEFAULT '',
  body TEXT NOT NULL, cover_url TEXT DEFAULT '', author TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
  blogger_id TEXT DEFAULT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  blogger_post_id TEXT, source_permalink TEXT, original_published_at TEXT, original_updated_at TEXT,
  is_magazine INTEGER NOT NULL DEFAULT 0 CHECK (is_magazine IN (0,1))
);

CREATE TABLE blogger_applications (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
  city TEXT DEFAULT '', motivation TEXT NOT NULL, cv_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bloggers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', application_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE google_oauth_tokens (
  id TEXT PRIMARY KEY, encrypted_refresh_token TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE google_picker_sessions (
  id TEXT PRIMARY KEY, album_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE INDEX idx_album_photos_album ON album_photos(album_id);
CREATE INDEX idx_album_photos_gmid ON album_photos(google_media_id);
CREATE INDEX idx_albums_status ON albums(status);
CREATE INDEX idx_article_likes_article ON article_likes(article_id);
CREATE INDEX idx_article_views_article ON article_views(article_id);
CREATE INDEX idx_articles_blogger ON articles(blogger_id);
CREATE UNIQUE INDEX idx_articles_blogger_post_id ON articles(blogger_post_id) WHERE blogger_post_id IS NOT NULL;
CREATE INDEX idx_articles_magazine_status ON articles(is_magazine,status,created_at);
CREATE INDEX idx_articles_original_published ON articles(original_published_at);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_blogger_apps_email ON blogger_applications(email);
CREATE INDEX idx_blogger_apps_status ON blogger_applications(status);
CREATE INDEX idx_bloggers_email ON bloggers(email);
CREATE INDEX idx_bloggers_status ON bloggers(status);
