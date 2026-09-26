import { all, row } from "@/lib/db/db";

export interface PublicBioPage {
  page: {
    id: string;
    slug: string;
    title: string;
    published: number;
    theme: Record<string, string>;
  };
  profile: {
    username: string;
    displayName: string;
    bio: string;
    avatarUrl: string;
    website: string;
    timezone: string;
    socials: Record<string, string>;
  };
  blocks: Array<{
    id: string;
    type: string;
    payload: Record<string, string>;
    position: number;
  }>;
  products: Array<{
    id: string;
    name: string;
    description: string;
    price_cents: number;
    currency: string;
    kind: string;
    media_url: string;
  }>;
  tenantId: string;
}

/**
 * Hydrate a public bio page from username (+ optional page slug).
 * Returns null if not found or unpublished.
 */
export function getPublicBioPage(username: string, pageSlug = ""): PublicBioPage | null {
  const profile = row<{ id: string; tenant_id: string; username: string; display_name: string; bio: string; avatar_url: string; website: string; timezone: string; socials: string }>(
    "SELECT id, tenant_id, username, display_name, bio, avatar_url, website, timezone, socials FROM profiles WHERE username = ?",
    username
  );
  if (!profile) return null;

  const page = row<{ id: string; slug: string; title: string; published: number; theme: string }>(
    "SELECT id, slug, title, published, theme FROM bio_pages WHERE profile_id = ? AND slug = ?",
    profile.id,
    pageSlug
  );
  if (!page || page.published !== 1) return null;

  const blocks = all<{ id: string; type: string; payload: string; position: number }>(
    "SELECT id, type, payload, position FROM bio_blocks WHERE page_id = ? AND active = 1 ORDER BY position ASC",
    page.id
  );

  const products = all<{ id: string; name: string; description: string; price_cents: number; currency: string; kind: string; media_url: string }>(
    "SELECT id, name, description, price_cents, currency, kind, media_url FROM products WHERE tenant_id = ? AND active = 1 AND (page_id IS NULL OR page_id = ?) ORDER BY created_at ASC",
    profile.tenant_id,
    page.id
  );

  return {
    page: {
      id: page.id,
      slug: page.slug,
      title: page.title,
      published: page.published,
      theme: safeJson(page.theme),
    },
    profile: {
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      website: profile.website,
      timezone: profile.timezone,
      socials: safeJson(profile.socials),
    },
    blocks: blocks.map((b) => ({ id: b.id, type: b.type, payload: safeJson<Record<string, string>>(b.payload), position: b.position })),
    products,
    tenantId: profile.tenant_id,
  };
}

export function getProfileForUser(tenantId: string, userId: string) {
  return row<{ id: string; username: string; display_name: string; bio: string; avatar_url: string; tenant_id: string }>(
    "SELECT id, username, display_name, bio, avatar_url, tenant_id FROM profiles WHERE tenant_id = ? AND user_id = ?",
    tenantId,
    userId
  );
}

function safeJson<T = Record<string, unknown>>(s: string, fallback: T = {} as T): T {
  try {
    const parsed = JSON.parse(s) as T;
    if (typeof parsed !== "object" || parsed === null) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}