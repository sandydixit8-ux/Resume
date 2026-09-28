import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, closeDb, run, nowIso } from "@/lib/db/db";
import {
  listCommunities,
  createCommunity,
  getCommunity,
  createPost,
  feed,
  toggleReaction,
  createComment,
  comments,
  deletePost,
  deleteCommunity,
} from "./engine";

let dir: string;
const TENANT = "org_com_test";
const OWNER = "usr_com_owner";
const MEMBER = "usr_com_member";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "creatoros-com-test-"));
  process.env.CREATOROS_DB_PATH = join(dir, "test.db");
  getDb();
  run("INSERT INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES (?, 'Com', 'com-org', 'creator', ?, ?)", TENANT, nowIso(), nowIso());
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, 'x', 'Owner', ?, ?)", OWNER, "owner@com.dev", nowIso(), nowIso());
  run("INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, 'x', 'Member', ?, ?)", MEMBER, "member@com.dev", nowIso(), nowIso());
});

afterAll(() => {
  closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("community engine", () => {
  it("creates and lists communities for a tenant", () => {
    const { id } = createCommunity(TENANT, OWNER, { name: "Product Launch", description: "Secret channel", public_flag: true });
    const list = listCommunities(TENANT);
    expect(list.some((c) => c.id === id && c.name === "Product Launch")).toBe(true);
    expect(getCommunity(TENANT, id)?.description).toBe("Secret channel");
    expect(getCommunity("other-tenant", id)).toBeUndefined();
  });

  it("posts a message to the feed with author names", () => {
    const community = listCommunities(TENANT)[0];
    const { id } = createPost(TENANT, MEMBER, community.id, "Welcome everyone!");
    const posts = feed(TENANT, MEMBER, community.id);
    const found = posts.find((p) => p.id === id);
    expect(found?.body).toBe("Welcome everyone!");
    expect(found?.author_name).toBe("Member");
  });

  it("toggles reactions per user and counts them", () => {
    const community = listCommunities(TENANT)[0];
    const post = feed(TENANT, MEMBER, community.id)[0];
    const first = toggleReaction(TENANT, OWNER, post.id);
    expect(first.reacted).toBe(true);
    expect(first.count).toBe(1);
    const second = toggleReaction(TENANT, MEMBER, post.id);
    expect(second.count).toBe(2);
    const removed = toggleReaction(TENANT, OWNER, post.id);
    expect(removed.reacted).toBe(false);
    expect(removed.count).toBe(1);
    const mine = feed(TENANT, MEMBER, community.id).find((p) => p.id === post.id);
    expect(mine?.my_reaction).toBe(1);
  });

  it("comments on posts and lists them newest last", () => {
    const community = listCommunities(TENANT)[0];
    const post = feed(TENANT, MEMBER, community.id)[0];
    createComment(TENANT, OWNER, post.id, "Great topic");
    expect(comments(TENANT, post.id).some((c) => c.body === "Great topic" && c.author_name === "Owner")).toBe(true);
  });

  it("allows only the author to delete a post, managers can delete anything", () => {
    const community = listCommunities(TENANT)[0];
    const post = feed(TENANT, MEMBER, community.id)[0];
    expect(deletePost(TENANT, OWNER, post.id, false)).toBe(false); // not the author, not manager
    expect(deletePost(TENANT, MEMBER, post.id, false)).toBe(true); // author
    const fresh = createPost(TENANT, MEMBER, community.id, "Another update");
    expect(deletePost(TENANT, OWNER, fresh.id, true)).toBe(true); // manager override
  });

  it("deletes a community for managers only", () => {
    const c = createCommunity(TENANT, OWNER, { name: "Temp", description: "", public_flag: false });
    expect(deleteCommunity(TENANT, OWNER, c.id)).toBe(true);
    expect(getCommunity(TENANT, c.id)).toBeUndefined();
    expect(deleteCommunity(TENANT, OWNER, "nope")).toBe(false);
  });

  it("rejects invalid targets", () => {
    expect(() => createPost(TENANT, OWNER, "missing-com", "hi")).toThrow("community_not_found");
    expect(() => toggleReaction(TENANT, OWNER, "missing-post")).toThrow("post_not_found");
    expect(() => createComment(TENANT, OWNER, "missing-post", "hi")).toThrow("post_not_found");
  });
});