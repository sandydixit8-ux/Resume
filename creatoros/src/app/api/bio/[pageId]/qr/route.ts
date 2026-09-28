import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth/get-session";
import { err } from "@/lib/http";
import { row } from "@/lib/db/db";
import { getProfileForUser } from "@/lib/bio/page";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ pageId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { pageId } = await ctx.params;

  const page = row<{ id: string; tenant_id: string; slug: string }>(
    "SELECT id, tenant_id, slug FROM bio_pages WHERE id = ? AND tenant_id = ?",
    pageId,
    s.org.id
  );
  if (!page) return err.notFound();

  const profile = getProfileForUser(s.org.id, s.user.id);
  if (!profile) return err.notFound();

  const url = `${SITE}/u/${profile.username}${page.slug ? `/${page.slug}` : ""}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 2, width: 240, color: { dark: "#141a2b", light: "#ffffff" } });

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}