import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/angelone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true, connected: false });
}
