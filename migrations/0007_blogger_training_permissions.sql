CREATE TABLE IF NOT EXISTS blogger_permissions (
  blogger_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(blogger_id, permission),
  FOREIGN KEY(blogger_id) REFERENCES bloggers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS blogger_training (
  blogger_id TEXT NOT NULL,
  lesson_key TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(blogger_id, lesson_key),
  FOREIGN KEY(blogger_id) REFERENCES bloggers(id) ON DELETE CASCADE
);
INSERT OR IGNORE INTO blogger_permissions(blogger_id,permission,enabled)
SELECT id, 'write_articles', 1 FROM bloggers;
INSERT OR IGNORE INTO blogger_permissions(blogger_id,permission,enabled)
SELECT id, 'edit_own_articles', 1 FROM bloggers;
INSERT OR IGNORE INTO blogger_permissions(blogger_id,permission,enabled)
SELECT id, 'import_word', 1 FROM bloggers;
