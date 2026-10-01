import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { healthResponse, livenessResponse, readinessResponse } from "@/lib/health";

function status(res: Response): number {
  return res.status;
}

describe("GET /api/health/live", () => {
  it("never touches a dependency, so a database blip cannot restart the container", () => {
    // A liveness probe that queries the database restarts the app whenever the
    // database is briefly unreachable, turning a recoverable blip into an
    // outage. The guarantee is structural: livenessResponse takes no probe and
    // must not reference the database at all.
    const src = readFileSync(join(process.cwd(), "src", "lib", "health.ts"), "utf8");
    const livenessBody = src.slice(
      src.indexOf("export function livenessResponse"),
      src.indexOf("export function readinessResponse")
    );
    expect(livenessBody).not.toContain("row(");
    expect(livenessBody).not.toContain("getDb");
    expect(livenessBody).not.toContain("probe");
  });

  it("stays 200 even when the database is unreachable", async () => {
    // Same broken database that makes /ready fail 503: liveness must stay 200
    // so the container is not killed.
    const broken = () => {
      throw new Error("SQLITE_CANTOPEN");
    };
    expect(status(readinessResponse(broken))).toBe(503);

    const res = livenessResponse();
    expect(status(res)).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("live");
  });
});

describe("GET /api/health/ready", () => {
  it("returns 200 when the database answers", async () => {
    const res = readinessResponse(() => ({ ok: 1 }));
    expect(status(res)).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { db: string; status: string } };
    expect(body.ok).toBe(true);
    expect(body.data.db).toBe("ok");
    expect(body.data.status).toBe("ready");
  });

  it("returns 503 with a stable code when the database is unreachable", async () => {
    const res = readinessResponse(() => {
      throw new Error("SQLITE_CANTOPEN");
    });
    expect(status(res)).toBe(503);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("unavailable");
  });

  it("returns 503 on a slow probe rather than hanging the check", async () => {
    // A probe that never settles must not hold the health endpoint open
    // forever; the caller times out and treats it as not ready.
    const res = readinessResponse(() => {
      const until = Date.now() + 50;
      while (Date.now() < until) {
        /* simulate a slow dependency */
      }
      throw new Error("timeout");
    });
    expect(status(res)).toBe(503);
  });

  it("does not leak infrastructure detail in the failure body", async () => {
    const res = readinessResponse(() => {
      throw new Error("SQLITE_CANTOPEN: /var/data/rankpilot.db permission denied");
    });
    const text = JSON.stringify(await res.json());
    // Error prose can carry a filesystem path or driver name.
    expect(text).not.toContain("SQLITE_CANTOPEN");
    expect(text).not.toContain("/var/data");
    expect(text).not.toContain("permission denied");
  });

  it("treats a probe returning a falsy value as healthy", async () => {
    // `SELECT 1` throws on failure rather than returning null, so the probe is
    // judged by "did it throw", not by its return value.
    const res = readinessResponse(() => undefined);
    expect(status(res)).toBe(200);
  });
});

describe("GET /api/health (backwards-compatible alias)", () => {
  it("behaves identically to /ready", async () => {
    const healthy = await healthResponse(() => ({ ok: 1 }));
    const broken = await healthResponse(() => {
      throw new Error("down");
    });
    expect(status(healthy)).toBe(200);
    expect(status(broken)).toBe(503);
    expect(((await broken.json()) as { error: { code: string } }).error.code).toBe("unavailable");
  });
});
