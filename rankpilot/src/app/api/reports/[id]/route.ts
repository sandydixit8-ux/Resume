import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSession } from "@/lib/auth/get-session";
import { err } from "@/lib/http";
import { row } from "@/lib/db/db";

const MIME: Record<string, string> = {
  json: "application/json",
  csv: "text/csv",
  pdf: "application/pdf",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { id } = await ctx.params;

  const report = row<{ file_path: string | null; format: string; status: string; type: string }>(
    "SELECT file_path, format, status, type FROM reports WHERE id = ? AND tenant_id = ?",
    id,
    s.org.id
  );
  if (!report || !report.file_path || report.status !== "completed") return err.notFound();

  try {
    const content = readFileSync(join(process.cwd(), report.file_path));
    return new Response(new Uint8Array(content), {
      headers: {
        "Content-Type": MIME[report.format] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="rankpilot-${report.type}-${id}.${report.format}"`,
      },
    });
  } catch {
    return err.notFound();
  }
}
