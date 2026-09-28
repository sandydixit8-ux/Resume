import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import { createNotification, listNotifications, unreadCount, markNotificationRead, markAllRead } from "./engine";

let dir: string;
const TENANT = "org_ntf_test";
const USER_A = "usr_ntf_a";
const USER_B = "usr_ntf_b";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-ntf-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Ntf', 'ntf-org', 'creator', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, 'x', 'A', ?, ?)", USER_A, "a@ntf.dev", nowIso(), nowIso());
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, 'x', 'B', ?, ?)", USER_B, "b@ntf.dev", nowIso(), nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("notifications engine", () => {
  it("creates and lists notifications for the right user", () => {
    createNotification(TENANT, USER_A, "New comment", "Nice post");
    createNotification(TENANT, USER_B, "New follower", "");
    const mine = listNotifications(TENANT, USER_A);
    expect(mine.length).toBe(1);
    expect(mine[0].title).toBe("New comment");
    expect(mine[0].read).toBe(false);
    expect(unreadCount(TENANT, USER_A)).toBe(1);
    expect(unreadCount(TENANT, USER_B)).toBe(1);
  });

  it("marks one notification read", () => {
    const first = listNotifications(TENANT, USER_A)[0];
    expect(markNotificationRead(TENANT, USER_A, first.id)).toBe(true);
    expect(listNotifications(TENANT, USER_A)[0].read).toBe(true);
    expect(unreadCount(TENANT, USER_A)).toBe(0);
    expect(markNotificationRead(TENANT, USER_A, "nope")).toBe(false);
  });

  it("marks all read and respects tenant isolation", () => {
    createNotification(TENANT, USER_A, "Another", "");
    createNotification(TENANT, USER_A, "One more", "");
    expect(unreadCount(TENANT, USER_A)).toBe(2);
    expect(markAllRead(TENANT, USER_A)).toBe(2);
    expect(unreadCount(TENANT, USER_A)).toBe(0);
    expect(unreadCount(TENANT, USER_B)).toBe(1); // untouched
    expect(markAllRead(TENANT, USER_A)).toBe(0);
  });

  it("lists are scoped to the tenant", () => {
    run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES ('other-tenant', 'Other', 'other-org', 'free', ?, ?)", nowIso(), nowIso());
    createNotification("other-tenant", USER_A, "Sneaky", "");
    expect(listNotifications(TENANT, USER_A).some((n) => n.title === "Sneaky")).toBe(false);
  });
});