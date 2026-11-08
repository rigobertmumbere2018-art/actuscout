-- Blogger source metadata for migrated ActuScout articles.
-- Additive only: existing articles and editorial workflow remain unchanged.
ALTER TABLE articles ADD COLUMN blogger_post_id TEXT;
ALTER TABLE articles ADD COLUMN source_permalink TEXT;
ALTER TABLE articles ADD COLUMN original_published_at TEXT;
ALTER TABLE articles ADD COLUMN original_updated_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_blogger_post_id
  ON articles(blogger_post_id) WHERE blogger_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_original_published
  ON articles(original_published_at);
