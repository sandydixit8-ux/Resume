import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/get-session";
import { ok, err, readJson } from "@/lib/http";
import { all, row, run, nowIso } from "@/lib/db/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/rbac";
import { validateAvailability } from "@/lib/booking/slots";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ serviceId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  const { serviceId } = await ctx.params;
  const service = row("SELECT * FROM services WHERE id = ? AND tenant_id = ?", serviceId, s.org.id);
  if (!service) return err.notFound();
  const windows = all("SELECT id, day_of_week, start_min, end_min FROM availability_windows WHERE service_id = ?", serviceId);
  return ok({ service, windows });
}

const windowSchema = z.object({
  windows: z
    .array(
      z.object({
        id: z.string().optional(),
        dayOfWeek: z.number().int().min(0).max(6),
        startMin: z.number().int().min(0).max(1440),
        endMin: z.number().int().min(0).max(1440),
      })
    )
    .max(42),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ serviceId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "booking:write")) return err.forbidden();
  const { serviceId } = await ctx.params;

  const service = row("SELECT id FROM services WHERE id = ? AND tenant_id = ?", serviceId, s.org.id);
  if (!service) return err.notFound();

  const body = await readJson(req);
  const parsed = windowSchema.safeParse(body);
  if (!parsed.success) return err.validation(parsed.error.flatten().fieldErrors);

  const invalid = validateAvailability(parsed.data.windows.map((w) => ({ dayOfWeek: w.dayOfWeek, startMin: w.startMin, endMin: w.endMin })));
  if (invalid) return err.validation({ windows: invalid });

  // Replace windows in a transaction-like sequence (sqlite sync, fine).
  run("DELETE FROM availability_windows WHERE service_id = ?", serviceId);
  for (const w of parsed.data.windows) {
    run(
      "INSERT INTO availability_windows (id, tenant_id, service_id, day_of_week, start_min, end_min, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      w.id ?? `avw_${Math.random().toString(36).slice(2, 10)}`,
      s.org.id,
      serviceId,
      w.dayOfWeek,
      w.startMin,
      w.endMin,
      nowIso()
    );
  }
  audit({ tenantId: s.org.id, userId: s.user.id, action: "booking.availability_update", resource: serviceId, ip: req.headers.get("x-forwarded-for") || undefined });
  return ok({ windows: parsed.data.windows.length });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ serviceId: string }> }) {
  const s = await getSession();
  if (!s) return err.auth();
  if (!can(s.role as never, "booking:write")) return err.forbidden();
  const { serviceId } = await ctx.params;
  const service = row("SELECT id FROM services WHERE id = ? AND tenant_id = ?", serviceId, s.org.id);
  if (!service) return err.notFound();
  run("DELETE FROM availability_windows WHERE service_id = ?", serviceId);
  run("DELETE FROM bookings WHERE service_id = ?", serviceId);
  run("DELETE FROM services WHERE id = ?", serviceId);
  audit({ tenantId: s.org.id, userId: s.user.id, action: "booking.service_delete", resource: serviceId, ip: _req.headers.get("x-forwarded-for") || undefined });
  return ok({ deleted: true });
}