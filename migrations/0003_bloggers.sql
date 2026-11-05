ALTER TABLE articles ADD COLUMN blogger_id TEXT;

CREATE TABLE IF NOT EXISTS blogger_applications (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL,
 city TEXT DEFAULT '',
 motivation TEXT NOT NULL,
 cv_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_blogger_applications_status ON blogger_applications(status);

CREATE TABLE IF NOT EXISTS bloggers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 phone TEXT DEFAULT '',
 password_hash TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active',
 application_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bloggers_status ON bloggers(status);
