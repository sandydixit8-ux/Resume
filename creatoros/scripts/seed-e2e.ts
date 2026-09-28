#!/usr/bin/env node
import { getDb, run, newId, nowIso, all } from "../src/lib/db/db";

// E2E fixtures: published store product + published course with a text and a
// quiz lesson for the demo tenant. Safe to re-run (idempotent per fresh DB).
getDb();

const org = all<{ id: string }>("SELECT id FROM organizations WHERE slug = 'demo-creator'");
if (org.length === 0) {
  console.log("Demo org missing; skipping e2e fixtures.");
  process.exit(0);
}
const tenant = org[0].id;

const profile = all<{ id: string }>("SELECT id FROM profiles WHERE tenant_id = ? LIMIT 1", tenant);
const page = all<{ id: string }>("SELECT id FROM bio_pages WHERE tenant_id = ? LIMIT 1", tenant);

if (all("SELECT id FROM products WHERE tenant_id = ? AND name = 'E2E Digital Guide'", tenant).length === 0) {
  run(
    "INSERT INTO products (id, tenant_id, page_id, name, description, price_cents, currency, kind, active, created_at, updated_at) VALUES (?, ?, ?, 'E2E Digital Guide', 'A guide for the E2E flow.', 500, 'usd', 'digital', 1, ?, ?)",
    newId("prd"),
    tenant,
    page[0]?.id ?? null,
    nowIso(),
    nowIso()
  );
  console.log("Seeded e2e product.");
}

if (all("SELECT id FROM courses WHERE tenant_id = ? AND slug = 'e2e-course'", tenant).length === 0) {
  const courseId = newId("crs");
  run(
    "INSERT INTO courses (id, tenant_id, profile_id, slug, title, description, price_cents, currency, cover_url, published, created_at, updated_at) VALUES (?, ?, ?, 'e2e-course', 'E2E Course', 'A course used by the E2E suite.', 0, 'usd', '', 1, ?, ?)",
    courseId,
    tenant,
    profile[0]?.id ?? null,
    nowIso(),
    nowIso()
  );

  const sectionId = newId("csc");
  run(
    "INSERT INTO course_sections (id, tenant_id, course_id, title, position, created_at) VALUES (?, ?, ?, 'Getting started', 0, ?)",
    sectionId,
    tenant,
    courseId,
    nowIso()
  );

  run(
    "INSERT INTO lessons (id, tenant_id, course_id, section_id, title, type, content, duration_min, position, published, created_at, updated_at) VALUES (?, ?, ?, ?, 'Welcome', 'text', 'Welcome to the E2E course. Mark this lesson complete to continue.', 0, 0, 1, ?, ?)",
    newId("lsn"),
    tenant,
    courseId,
    sectionId,
    nowIso(),
    nowIso()
  );

  const quiz = JSON.stringify({ question: "What is 2 + 2?", options: ["3", "4", "5"], answerIndex: 1 });
  run(
    "INSERT INTO lessons (id, tenant_id, course_id, section_id, title, type, content, duration_min, position, published, created_at, updated_at) VALUES (?, ?, ?, ?, 'Quick check', 'quiz', ?, 0, 1, 1, ?, ?)",
    newId("lsn"),
    tenant,
    courseId,
    sectionId,
    quiz,
    nowIso(),
    nowIso()
  );

  console.log("Seeded e2e course.");
}

console.log("E2E fixtures ready.");
process.exit(0);