import { all, row, run, newId, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";

export interface CommunitySummary {
  id: string;
  name: string;
  description: string;
  public_flag: number;
  member_count: number;
  post_count: number;
  created_at: string;
}

export interface FeedPost {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  reactions: number;
  comments: number;
  my_reaction: number;
  created_at: string;
}

export interface PostComment {
  id: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export function listCommunities(tenantId: string): CommunitySummary[] {
  return all<CommunitySummary>(
    `SELECT c.id, c.name, c.description, c.public_flag, c.created_at,
      COUNT(DISTINCT p.author_id) AS member_count,
      (SELECT COUNT(*) FROM posts WHERE community_id = c.id) AS post_count
     FROM communities c
     LEFT JOIN posts p ON p.community_id = c.id
     WHERE c.tenant_id = ?
     GROUP BY c.id ORDER BY c.created_at DESC`,
    tenantId
  );
}

export function getCommunity(tenantId: string, communityId: string) {
  return row<CommunitySummary>(
    `SELECT c.id, c.name, c.description, c.public_flag, c.created_at,
      COUNT(DISTINCT p.author_id) AS member_count,
      (SELECT COUNT(*) FROM posts WHERE community_id = c.id) AS post_count
     FROM communities c
     LEFT JOIN posts p ON p.community_id = c.id
     WHERE c.tenant_id = ? AND c.id = ?
     GROUP BY c.id`,
    tenantId,
    communityId
  );
}

export function createCommunity(tenantId: string, userId: string, input: { name: string; description: string; public_flag: boolean }): { id: string } {
  const id = newId("com");
  run(
    "INSERT INTO communities (id, tenant_id, name, description, public_flag, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    tenantId,
    input.name.trim(),
    input.description.trim(),
    input.public_flag ? 1 : 0,
    nowIso()
  );
  audit({ tenantId, userId, action: "community.create", resource: id, meta: { name: input.name } });
  return { id };
}

export function deleteCommunity(tenantId: string, userId: string, communityId: string): boolean {
  const community = row<{ id: string }>("SELECT id FROM communities WHERE id = ? AND tenant_id = ?", communityId, tenantId);
  if (!community) return false;
  run("DELETE FROM communities WHERE id = ?", communityId);
  audit({ tenantId, userId, action: "community.delete", resource: communityId });
  return true;
}

export function createPost(tenantId: string, userId: string, communityId: string, body: string): { id: string } {
  const community = row<{ id: string }>("SELECT id FROM communities WHERE id = ? AND tenant_id = ?", communityId, tenantId);
  if (!community) throw new Error("community_not_found");
  const id = newId("pst");
  run(
    "INSERT INTO posts (id, tenant_id, community_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    tenantId,
    communityId,
    userId,
    body.trim(),
    nowIso()
  );
  audit({ tenantId, userId, action: "community.post_create", resource: id });
  return { id };
}

export function deletePost(tenantId: string, userId: string, postId: string, manager: boolean): boolean {
  const post = row<{ id: string; author_id: string }>("SELECT id, author_id FROM posts WHERE id = ? AND tenant_id = ?", postId, tenantId);
  if (!post) return false;
  if (!manager && post.author_id !== userId) return false;
  run("DELETE FROM posts WHERE id = ?", postId);
  audit({ tenantId, userId, action: "community.post_delete", resource: postId });
  return true;
}

export function toggleReaction(tenantId: string, userId: string, postId: string, emoji = "👍"): { reacted: boolean; count: number } {
  const post = row<{ id: string }>("SELECT id FROM posts WHERE id = ? AND tenant_id = ?", postId, tenantId);
  if (!post) throw new Error("post_not_found");
  const existing = row<{ id: string }>("SELECT id FROM post_reactions WHERE post_id = ? AND user_id = ?", postId, userId);
  if (existing) {
    run("DELETE FROM post_reactions WHERE id = ?", existing.id);
  } else {
    run(
      "INSERT INTO post_reactions (id, tenant_id, post_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      newId("rea"),
      tenantId,
      postId,
      userId,
      emoji,
      nowIso()
    );
  }
  const count = (row<{ c: number }>("SELECT COUNT(*) AS c FROM post_reactions WHERE post_id = ?", postId) as { c: number }).c;
  return { reacted: !existing, count };
}

export function createComment(tenantId: string, userId: string, postId: string, body: string): { id: string } {
  const post = row<{ id: string }>("SELECT id FROM posts WHERE id = ? AND tenant_id = ?", postId, tenantId);
  if (!post) throw new Error("post_not_found");
  const id = newId("cmt");
  run(
    "INSERT INTO post_comments (id, tenant_id, post_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    tenantId,
    postId,
    userId,
    body.trim(),
    nowIso()
  );
  audit({ tenantId, userId, action: "community.comment", resource: id, meta: { postId } });
  return { id };
}

export function feed(tenantId: string, userId: string, communityId: string): FeedPost[] {
  return all<FeedPost>(
    `SELECT p.id, p.body, p.author_id, u.name AS author_name, p.created_at,
      (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id) AS reactions,
      (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS comments,
      (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id AND r.user_id = ?) AS my_reaction
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.tenant_id = ? AND p.community_id = ?
     ORDER BY p.created_at DESC LIMIT 100`,
    userId,
    tenantId,
    communityId
  );
}

export function comments(tenantId: string, postId: string): PostComment[] {
  return all<PostComment>(
    `SELECT c.id, c.body, c.author_id, u.name AS author_name, c.created_at
     FROM post_comments c
     JOIN users u ON u.id = c.author_id
     WHERE c.tenant_id = ? AND c.post_id = ?
     ORDER BY c.created_at ASC LIMIT 100`,
    tenantId,
    postId
  );
}