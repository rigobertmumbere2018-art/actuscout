CREATE TABLE IF NOT EXISTS albums (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT DEFAULT '',event_date TEXT DEFAULT '',source_url TEXT DEFAULT '',cover_url TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY,title TEXT NOT NULL,category TEXT DEFAULT '',excerpt TEXT DEFAULT '',body TEXT NOT NULL,cover_url TEXT DEFAULT '',author TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_albums_status ON albums(status);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);

-- Albums de départ fournis par l'équipe ActuScout
INSERT OR IGNORE INTO albums (id,title,description,event_date,source_url,status) VALUES
('album-ecole-vie','À l’école de la vie','Chronique ActuScout — titre provisoire.','', 'https://drive.google.com/drive/folders/1gHEd4S7YC_3naCtejc5hZ27yqoP-RBoY?usp=drive_link','published'),
('album-chasse-bosconia','Chasse conjointe DSVG à Bosconia','Activité réunissant plusieurs meutes de Goma.','29 mars','https://photos.app.goo.gl/SRWuZEM8TfjeSqjw7','published');
