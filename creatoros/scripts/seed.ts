#!/usr/bin/env node
import { getDb, run, newId, nowIso, all } from "../src/lib/db/db";
import { hashPassword } from "../src/lib/auth/password";

getDb();

// Seed a demo creator tenant for development
const email = "demo@creatoros.dev";
const existing = all("SELECT id FROM users WHERE email = ?", email);
if (existing.length === 0) {
  const passwordHash = hashPassword("Demo1234!");
  const uid = newId("usr");
  const orgId = newId("org");
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, 'Demo Creator', ?, ?)", uid, email, passwordHash, nowIso(), nowIso());
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Demo Creator', 'demo-creator', 'creator', ?, ?)", orgId, nowIso(), nowIso());
  run("INSERT INTO memberships (id, tenant_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)", newId("mem"), orgId, uid, nowIso());
  const profileId = newId("prf");
  run("INSERT INTO profiles (id, tenant_id, user_id, username, display_name, bio, created_at, updated_at) VALUES (?, ?, ?, 'democreator', 'Demo Creator', 'Helping creators monetize their audience.', ?, ?)", profileId, orgId, uid, nowIso(), nowIso());
  const pageId = newId("bio");
  run("INSERT INTO bio_pages (id, tenant_id, profile_id, slug, title, published, created_at, updated_at) VALUES (?, ?, ?, '', 'Demo Page', 1, ?, ?)", pageId, orgId, profileId, nowIso(), nowIso());
  run("INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, created_at, updated_at) VALUES (?, ?, ?, 'profile', ?, 0, ?, ?)", newId("blk"), orgId, pageId, JSON.stringify({ title: "Demo Creator", subtitle: "CreatorOS" }), nowIso(), nowIso());
  const svcId = newId("svc");
  run("INSERT INTO services (id, tenant_id, name, description, duration_min, price_cents, currency, buffer_min, active, slug, created_at, updated_at) VALUES (?, ?, '30-min Strategy Call', 'Free intro call for new creators.', 30, 0, 'usd', 0, 1, 'strategy-call', ?, ?)", svcId, orgId, nowIso(), nowIso());
  run("INSERT INTO availability_windows (id, tenant_id, service_id, day_of_week, start_min, end_min, created_at) VALUES (?, ?, ?, 1, 540, 600, ?)", newId("avw"), orgId, svcId, nowIso());
  run("INSERT INTO availability_windows (id, tenant_id, service_id, day_of_week, start_min, end_min, created_at) VALUES (?, ?, ?, 3, 540, 600, ?)", newId("avw"), orgId, svcId, nowIso());
  run("INSERT INTO availability_windows (id, tenant_id, service_id, day_of_week, start_min, end_min, created_at) VALUES (?, ?, ?, 5, 540, 600, ?)", newId("avw"), orgId, svcId, nowIso());
  run("INSERT INTO availability_windows (id, tenant_id, service_id, day_of_week, start_min, end_min, created_at) VALUES (?, ?, ?, 6, 600, 720, ?)", newId("avw"), orgId, svcId, nowIso());
  run("INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, created_at, updated_at) VALUES (?, ?, ?, 'booking', ?, 1, ?, ?)", newId("blk"), orgId, pageId, JSON.stringify({ serviceSlug: "strategy-call" }), nowIso(), nowIso());
  run("INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, created_at, updated_at) VALUES (?, ?, ?, 'email_capture', ?, 2, ?, ?)", newId("blk"), orgId, pageId, JSON.stringify({ title: "Get free creator monetization tips", buttonLabel: "Subscribe" }), nowIso(), nowIso());
  run("INSERT INTO bio_blocks (id, tenant_id, page_id, type, payload, position, created_at, updated_at) VALUES (?, ?, ?, 'link', ?, 3, ?, ?)", newId("blk"), orgId, pageId, JSON.stringify({ title: "My latest YouTube video", url: "https://example.com/video" }), nowIso(), nowIso());
  console.log("Seeded demo user:", email);
} else {
  console.log("Demo user already exists.");
}
process.exit(0);