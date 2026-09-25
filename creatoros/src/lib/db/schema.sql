-- ToolPilotPro CreatorOS — PostgreSQL-portable schema (runs on node:sqlite)
-- All PKs are text UUID-like ids. Tenant rows carry tenant_id (org id).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'user',        -- user | admin
  email_verified  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  slug        TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',   -- free | starter | creator | pro | business
  trial_ends  TEXT,
  settings    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'owner',   -- owner | admin | editor | viewer
  created_at      TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'stripe',
  provider_id     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',  -- active | trialing | past_due | canceled
  plan            TEXT NOT NULL,
  current_period_end TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans_usage (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL,                -- views | contacts | services | ai_credits ...
  period     TEXT NOT NULL,                -- YYYY-MM
  used       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, metric, period)
);

CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT NOT NULL DEFAULT '',
  website       TEXT NOT NULL DEFAULT '',
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  socials       TEXT NOT NULL DEFAULT '{}',     -- JSON {instagram, twitter, youtube, ...}
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bio_pages (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,                  -- page slug ("" default = profile username)
  title         TEXT NOT NULL DEFAULT '',
  published     INTEGER NOT NULL DEFAULT 1,
  theme         TEXT NOT NULL DEFAULT '{}',     -- JSON {accent, bg, radius}
  custom_domain TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (profile_id, slug)
);

CREATE TABLE IF NOT EXISTS bio_blocks (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id     TEXT NOT NULL REFERENCES bio_pages(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                    -- profile | bio | link | product | booking | email_capture | cta | social
  payload     TEXT NOT NULL DEFAULT '{}',       -- JSON {title, url, price, icon, ...}
  position    INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id       TEXT REFERENCES bio_pages(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'usd',
  kind          TEXT NOT NULL DEFAULT 'digital',  -- digital | service | physical
  media_url     TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  duration_min  INTEGER NOT NULL DEFAULT 30,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'usd',
  buffer_min    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  slug          TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS availability_windows (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id  TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,               -- 0=Sun .. 6=Sat
  start_min   INTEGER NOT NULL,               -- minutes from midnight local
  end_min     INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  consent     INTEGER NOT NULL DEFAULT 0,     -- GDPR double-opt-in flag
  source      TEXT NOT NULL DEFAULT '',       -- bio page / campaign / qr
  page_id     TEXT REFERENCES bio_pages(id) ON DELETE SET NULL,
  utm_source  TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_id     TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  contact_id     TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  attendee_name  TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  starts_at      TEXT NOT NULL,               -- ISO UTC
  ends_at        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'confirmed',  -- confirmed | canceled | completed | rescheduled
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  notes          TEXT NOT NULL DEFAULT '',
  reminder_sent  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  page_id     TEXT REFERENCES bio_pages(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,                 -- page_view | lead | booking | link_click
  visitor_id  TEXT NOT NULL DEFAULT '',      -- salted hash, privacy-safe
  ref         TEXT NOT NULL DEFAULT '',
  utm_source  TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  device      TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_lists (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  list_id     TEXT REFERENCES email_lists(id) ON DELETE SET NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | scheduled | sent
  scheduled_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,               -- social | business | marketing | creator | pmo | career | ai
  content     TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  premium     INTEGER NOT NULL DEFAULT 0,
  icon        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS communities (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  public_flag INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  community_id TEXT REFERENCES communities(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_workflows (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  trigger     TEXT NOT NULL,               -- lead | booking | purchase
  steps_json  TEXT NOT NULL DEFAULT '{}',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  read_flag   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL DEFAULT 'stripe',
  provider_id  TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'usd',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed | refunded
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT,
  user_id    TEXT,
  action     TEXT NOT NULL,
  resource   TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '{}',
  ip         TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id      TEXT PRIMARY KEY,
  flag    TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT,
  user_id    TEXT,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bio_pages_tenant ON bio_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON bio_blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_time ON analytics_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_page ON analytics_events(page_id, event_type);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_avail_service ON availability_windows(service_id);