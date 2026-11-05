CREATE TABLE IF NOT EXISTS google_oauth_tokens (id TEXT PRIMARY KEY, encrypted_refresh_token TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS album_photos (id TEXT PRIMARY KEY, album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE, object_key TEXT NOT NULL, public_url TEXT NOT NULL, mime_type TEXT NOT NULL DEFAULT 'image/jpeg', google_media_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_album_photos_album ON album_photos(album_id, created_at);
CREATE TABLE IF NOT EXISTS google_picker_sessions (id TEXT PRIMARY KEY, album_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
