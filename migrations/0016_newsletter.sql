-- Newsletter ActuScout: consent, confirmation, campaigns and delivery history.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','unsubscribed')),
  confirmation_token_hash TEXT,
  consent_at TEXT NOT NULL,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status_created
  ON newsletter_subscribers(status, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  preheader TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','sending','sent','failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created
  ON newsletter_campaigns(created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent','failed')),
  error TEXT,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_campaign
  ON newsletter_deliveries(campaign_id, status);
