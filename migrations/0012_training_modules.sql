CREATE TABLE IF NOT EXISTS trainer_applications (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
 country TEXT NOT NULL, city TEXT NOT NULL, neighborhood TEXT NOT NULL, avenue TEXT NOT NULL, street TEXT NOT NULL,
 scout_group TEXT NOT NULL, scout_district TEXT NOT NULL, scout_association TEXT NOT NULL, scout_federation TEXT NOT NULL,
 scout_cv_key TEXT NOT NULL, experience TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT, reviewer_note TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_trainer_applications_status ON trainer_applications(status);
CREATE TABLE IF NOT EXISTS trainers (
 id TEXT PRIMARY KEY, blogger_id TEXT NOT NULL UNIQUE REFERENCES bloggers(id) ON DELETE CASCADE,
 application_id TEXT NOT NULL UNIQUE REFERENCES trainer_applications(id), status TEXT NOT NULL DEFAULT 'approved',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS training_modules (
 id TEXT PRIMARY KEY, trainer_id TEXT NOT NULL REFERENCES trainers(id), title TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
 media_key TEXT DEFAULT '', media_url TEXT DEFAULT '', media_type TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_training_modules_status ON training_modules(status,created_at);
CREATE TABLE IF NOT EXISTS module_contributions (
 id TEXT PRIMARY KEY, module_id TEXT NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
 blogger_id TEXT NOT NULL REFERENCES bloggers(id), contribution_type TEXT NOT NULL,
 content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_module_contributions_status ON module_contributions(status,created_at);