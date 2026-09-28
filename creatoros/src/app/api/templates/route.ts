import { NextRequest } from "next/server";
import { ok } from "@/lib/http";
import { listTemplates, TEMPLATE_CATEGORIES } from "@/lib/templates";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? "";
  const q = sp.get("q") ?? "";
  const validCategory = (TEMPLATE_CATEGORIES as readonly string[]).includes(category) ? category : "";
  const templates = listTemplates(validCategory || undefined, q || undefined).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    premium: t.premium,
    theme: t.theme,
    blocks: t.blocks,
  }));
  return ok({ categories: TEMPLATE_CATEGORIES, templates });
}