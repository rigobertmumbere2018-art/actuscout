CREATE TABLE IF NOT EXISTS admin_modules (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 url TEXT NOT NULL,
 icon TEXT NOT NULL DEFAULT '▦',
 position INTEGER NOT NULL DEFAULT 50,
 enabled INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_modules_position ON admin_modules(enabled,position,created_at);
