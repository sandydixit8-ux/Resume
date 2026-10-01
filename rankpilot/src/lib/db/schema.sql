-- RankPilot AI schema (source of truth; applied idempotently at boot)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  mode TEXT NOT NULL DEFAULT 'individual',
  branding TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

-- Password reset tokens. Only the SHA-256 of the token is stored, so a database
-- leak (backup, copy, SQL injection) cannot be replayed to take over accounts.
-- `used_at` makes a token single-use; changing the password also revokes every
-- session for that user, which is the whole point of a reset.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  requested_ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- Email verification tokens. Same shape as reset tokens for the same reason:
-- hashed at rest, single use, expiring, one live token per user.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  requested_ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT,
  provider_ref TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  period TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, metric, period)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error TEXT,
  locked_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  task TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  cached INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  verification_token TEXT,
  verified_at TEXT,
  industry TEXT,
  country TEXT,
  audience TEXT,
  products TEXT,
  primary_keywords TEXT,
  target_market TEXT,
  competitor_urls TEXT NOT NULL DEFAULT '[]',
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  crawl_schedule TEXT,
  last_crawled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (tenant_id, normalized_url)
);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  trigger TEXT NOT NULL DEFAULT 'manual',
  started_at TEXT,
  finished_at TEXT,
  pages_discovered INTEGER NOT NULL DEFAULT 0,
  pages_analyzed INTEGER NOT NULL DEFAULT 0,
  issues_found INTEGER NOT NULL DEFAULT 0,
  keywords_found INTEGER NOT NULL DEFAULT 0,
  questions_found INTEGER NOT NULL DEFAULT 0,
  opportunities_found INTEGER NOT NULL DEFAULT 0,
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  avg_response_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  stats TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crawl_urls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES crawl_runs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  url_key TEXT NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'link',
  status TEXT NOT NULL DEFAULT 'pending',
  http_status INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  fetched_at TEXT,
  UNIQUE (run_id, url_key)
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES crawl_runs(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  url_key TEXT NOT NULL,
  status_code INTEGER,
  redirect_url TEXT,
  content_type TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  title_len INTEGER,
  meta_description TEXT,
  meta_desc_len INTEGER,
  h1 TEXT,
  headings TEXT NOT NULL DEFAULT '[]',
  canonical TEXT,
  robots_meta TEXT,
  is_indexable INTEGER NOT NULL DEFAULT 1,
  word_count INTEGER NOT NULL DEFAULT 0,
  lang TEXT,
  internal_link_count INTEGER NOT NULL DEFAULT 0,
  external_link_count INTEGER NOT NULL DEFAULT 0,
  inbound_link_count INTEGER NOT NULL DEFAULT 0,
  image_count INTEGER NOT NULL DEFAULT 0,
  images_missing_alt INTEGER NOT NULL DEFAULT 0,
  html_bytes INTEGER NOT NULL DEFAULT 0,
  ttfb_ms INTEGER NOT NULL DEFAULT 0,
  has_structured_data INTEGER NOT NULL DEFAULT 0,
  structured_types TEXT NOT NULL DEFAULT '[]',
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  text_sample TEXT,
  fetched_at TEXT NOT NULL,
  UNIQUE (website_id, url_key)
);

CREATE TABLE IF NOT EXISTS seo_issues (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES crawl_runs(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES crawl_runs(id) ON DELETE CASCADE,
  overall INTEGER NOT NULL,
  components TEXT NOT NULL DEFAULT '{}',
  methodology TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'crawl',
  intent TEXT NOT NULL DEFAULT 'informational',
  volume INTEGER,
  difficulty INTEGER,
  current_rank INTEGER,
  ctr REAL,
  recommended_url TEXT,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  occurrences INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (website_id, term, source)
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'informational',
  source TEXT NOT NULL DEFAULT 'content',
  priority TEXT NOT NULL DEFAULT 'medium',
  recommended_answer TEXT,
  recommended_url TEXT,
  schema_type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  is_pillar INTEGER NOT NULL DEFAULT 0,
  coverage INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'missing',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  issue_id TEXT REFERENCES seo_issues(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  impact TEXT NOT NULL DEFAULT 'medium',
  effort TEXT NOT NULL DEFAULT 'medium',
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new',
  due_date TEXT,
  source TEXT NOT NULL DEFAULT 'issue',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS schema_markup (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  schema_type TEXT NOT NULL,
  json_ld TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS internal_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  anchor_text TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'article',
  title TEXT NOT NULL,
  slug TEXT,
  body TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  channel TEXT NOT NULL DEFAULT 'web',
  source_content_id TEXT REFERENCES content(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS social_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_ideas (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES social_campaigns(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  hook TEXT NOT NULL DEFAULT '',
  pain_point TEXT NOT NULL DEFAULT '',
  emotional_angle TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  selected INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_scripts (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES social_ideas(id) ON DELETE CASCADE,
  duration_sec INTEGER NOT NULL DEFAULT 30,
  structure TEXT NOT NULL DEFAULT '{}',
  hook TEXT NOT NULL DEFAULT '',
  scenes TEXT NOT NULL DEFAULT '[]',
  voiceover TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_calendar (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
  publish_at TEXT NOT NULL,
  platform TEXT NOT NULL,
  topic TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  content_id TEXT REFERENCES content(id) ON DELETE SET NULL,
  social_script_id TEXT REFERENCES social_scripts(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'json',
  status TEXT NOT NULL DEFAULT 'pending',
  params TEXT NOT NULL DEFAULT '{}',
  file_path TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

-- ===== Phase 2: content versions & approval =====
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  changes TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS schema_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  schema_type TEXT NOT NULL,
  json_ld TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

-- ===== Phase 3: integrations & intelligence =====
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  score INTEGER,
  overlap_keywords INTEGER NOT NULL DEFAULT 0,
  last_audited_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (website_id, url)
);

CREATE TABLE IF NOT EXISTS competitor_keywords (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  in_content INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_gaps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  competitor_id TEXT REFERENCES competitors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'missing',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TEXT NOT NULL,
  UNIQUE (website_id, term)
);

CREATE TABLE IF NOT EXISTS crawl_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  enabled INTEGER NOT NULL DEFAULT 1,
  next_run_at TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL
);

-- ===== Phase 4: copilot, experiments, visibility =====
CREATE TABLE IF NOT EXISTS copilot_threads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New thread',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES copilot_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  epistemic TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL DEFAULT '',
  metric TEXT NOT NULL DEFAULT 'ctr',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content_id TEXT REFERENCES content(id) ON DELETE SET NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  traffic_pct INTEGER NOT NULL DEFAULT 50,
  result_value REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_visibility (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  engine TEXT NOT NULL DEFAULT 'general',
  query TEXT NOT NULL,
  brand_mentioned INTEGER,
  competitor_mentions TEXT NOT NULL DEFAULT '[]',
  source_urls TEXT NOT NULL DEFAULT '[]',
  checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ===== Phase 5: billing, clients, CMS fixes =====
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_usd REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid',
  provider TEXT,
  provider_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_fixes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  issue_id TEXT REFERENCES seo_issues(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'manual',
  payload TEXT NOT NULL DEFAULT '{}',
  backup_ref TEXT,
  -- The pre-change content captured before an apply, so a restore is possible
  -- rather than just referenceable. NULL while a fix is still only proposed.
  backup_content TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  error TEXT,
  created_at TEXT NOT NULL,
  applied_at TEXT,
  verified_at TEXT
);

-- ===== Phase 6: agent & attribution =====
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_date TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  priorities TEXT NOT NULL DEFAULT '[]',
  opportunities TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revenue_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual',
  label TEXT NOT NULL DEFAULT '',
  amount_usd REAL NOT NULL DEFAULT 0,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_id TEXT REFERENCES websites(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  credentials TEXT NOT NULL DEFAULT '{}',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS free_audits (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  email TEXT,
  ip TEXT,
  score INTEGER,
  snapshot TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  -- Retention deadline. These rows hold an email address and an IP, so they
  -- are personal data with a deletion date rather than kept indefinitely.
  -- The index on this column is created in db.ts migration 4, not here: on a
  -- pre-existing database `CREATE TABLE IF NOT EXISTS` is a no-op, so an index
  -- written in this file would reference a column that does not exist yet.
  expires_at TEXT
);

-- OAuth (login with Google, etc). One row per (provider, provider-specific
-- subject) so the same human is recognised on a later sign-in. The link back to
-- users is unique; subject ids are opaque provider strings, never derived from
-- the user's email, so a provider that recycles a subject cannot silently fold
-- two accounts together.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON websites(tenant_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_runs_website ON crawl_runs(website_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_run ON crawl_urls(run_id, status);
CREATE INDEX IF NOT EXISTS idx_pages_website ON pages(website_id, run_id);
CREATE INDEX IF NOT EXISTS idx_issues_website ON seo_issues(website_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_issues_page ON seo_issues(page_id);
CREATE INDEX IF NOT EXISTS idx_keywords_website ON keywords(website_id);
CREATE INDEX IF NOT EXISTS idx_questions_website ON questions(website_id);
CREATE INDEX IF NOT EXISTS idx_actions_tenant ON actions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_usage_tenant ON plans_usage(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_content_versions ON content_versions(content_id, version);
CREATE INDEX IF NOT EXISTS idx_competitors_website ON competitors(website_id);
CREATE INDEX IF NOT EXISTS idx_gap_website ON content_gaps(website_id, status);
CREATE INDEX IF NOT EXISTS idx_schedules_due ON crawl_schedules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_copilot_threads ON copilot_threads(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_copilot_messages ON copilot_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_experiments_website ON experiments(website_id, status);
CREATE INDEX IF NOT EXISTS idx_visibility_website ON ai_visibility(website_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cms_fixes ON cms_fixes(website_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs ON agent_runs(tenant_id, run_date);
CREATE INDEX IF NOT EXISTS idx_social_ideas_campaign ON social_ideas(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calendar_slot ON content_calendar(tenant_id, publish_at);
CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports(tenant_id, created_at);
