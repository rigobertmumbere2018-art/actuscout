-- ActuScout monetization foundations and private admin-to-blogger inbox.
CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL DEFAULT 'admin',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inbox_message_reads (
  message_id TEXT NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(message_id, blogger_id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_blogger_created ON inbox_messages(blogger_id, created_at DESC);

CREATE TABLE IF NOT EXISTS monetization_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  description TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO monetization_settings(setting_key,setting_value,description) VALUES
 ('bloggers_share_percent','40','Part collective des blogueurs sur les revenus publicitaires nets distribuables'),
 ('platform_share_percent','40','Part de fonctionnement ActuScout'),
 ('reserve_share_percent','20','Réserve de développement'),
 ('minimum_payout_usd','10','Seuil minimum de retrait en USD'),
 ('minimum_approved_articles','3','Nombre initial proposé d’articles validés pour être éligible'),
 ('payout_frequency','monthly','Fréquence des paiements'),
 ('score_views_weight','35','Pondération des lectures qualifiées'),
 ('score_engagement_weight','15','Pondération de l’engagement authentique'),
 ('score_quality_weight','35','Pondération de la qualité éditoriale'),
 ('score_consistency_weight','15','Pondération de la régularité');
CREATE TABLE IF NOT EXISTS monetization_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS monetization_revenues (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES monetization_sources(id),
  description TEXT NOT NULL,
  gross_amount REAL NOT NULL DEFAULT 0 CHECK(gross_amount>=0),
  direct_costs REAL NOT NULL DEFAULT 0 CHECK(direct_costs>=0),
  adjustments REAL NOT NULL DEFAULT 0,
  net_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  period_start TEXT,
  period_end TEXT,
  received_at TEXT,
  status TEXT NOT NULL DEFAULT 'estimated',
  proof_r2_key TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS monetization_periods (
  id TEXT PRIMARY KEY,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  gross_revenue REAL NOT NULL DEFAULT 0,
  net_distributable REAL NOT NULL DEFAULT 0,
  bloggers_pool REAL NOT NULL DEFAULT 0,
  platform_share REAL NOT NULL DEFAULT 0,
  development_reserve REAL NOT NULL DEFAULT 0,
  settings_snapshot TEXT NOT NULL DEFAULT '{}',
  calculated_at TEXT,
  validated_at TEXT,
  validated_by TEXT,
  closed_at TEXT,
  UNIQUE(period_year,period_month)
);
CREATE TABLE IF NOT EXISTS blogger_eligibility (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_eligible',
  published_articles_count INTEGER NOT NULL DEFAULT 0,
  minimum_articles_required INTEGER NOT NULL DEFAULT 3,
  eligible_since TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  reason TEXT,
  UNIQUE(blogger_id)
);
CREATE TABLE IF NOT EXISTS blogger_scores (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES monetization_periods(id),
  qualified_views_score REAL NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,
  editorial_quality_score REAL NOT NULL DEFAULT 0,
  consistency_score REAL NOT NULL DEFAULT 0,
  total_score REAL NOT NULL DEFAULT 0,
  score_details TEXT NOT NULL DEFAULT '{}',
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_by TEXT,
  UNIQUE(blogger_id,period_id)
);
CREATE TABLE IF NOT EXISTS blogger_earnings (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  period_id TEXT NOT NULL REFERENCES monetization_periods(id),
  gross_allocation REAL NOT NULL DEFAULT 0,
  adjustments REAL NOT NULL DEFAULT 0,
  net_earning REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_at TEXT,
  validated_by TEXT,
  UNIQUE(blogger_id,period_id)
);
CREATE TABLE IF NOT EXISTS blogger_wallets (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL UNIQUE REFERENCES bloggers(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  available_balance REAL NOT NULL DEFAULT 0,
  pending_balance REAL NOT NULL DEFAULT 0,
  reserved_balance REAL NOT NULL DEFAULT 0,
  paid_balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS blogger_payment_methods (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_reference_encrypted TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CD',
  currency TEXT NOT NULL DEFAULT 'USD',
  is_default INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payout_requests (
  id TEXT PRIMARY KEY,
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK(amount>=10),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method_id TEXT NOT NULL REFERENCES blogger_payment_methods(id),
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  reviewed_by TEXT,
  rejection_reason TEXT
);
CREATE TABLE IF NOT EXISTS payout_transactions (
  id TEXT PRIMARY KEY,
  payout_request_id TEXT NOT NULL UNIQUE REFERENCES payout_requests(id),
  blogger_id TEXT NOT NULL REFERENCES bloggers(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate REAL,
  paid_amount REAL,
  provider TEXT,
  transaction_reference TEXT,
  proof_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  confirmed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financial_ledger (
  id TEXT PRIMARY KEY,
  transaction_type TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  account_code TEXT NOT NULL,
  debit_amount REAL NOT NULL DEFAULT 0,
  credit_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values TEXT,
  new_values TEXT,
  reason TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_monetization_revenues_status_received ON monetization_revenues(status,received_at);
CREATE INDEX IF NOT EXISTS idx_blogger_earnings_blogger_period ON blogger_earnings(blogger_id,period_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status_date ON payout_requests(status,requested_at);
