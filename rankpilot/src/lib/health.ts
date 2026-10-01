import { fail, ok } from "@/lib/http";
import { row } from "@/lib/db/db";

export type Probe = () => unknown;

/**
 * Health, split three ways.
 *
 * Getting this wrong is how a healthy process gets killed or a broken one keeps
 * serving traffic, so the three answers mean different things:
 *
 *  - `/live`  -- is the process running? Deliberately touches nothing external.
 *    A failing liveness check restarts the container, so it must NOT depend on
 *    the database: a brief database outage should not cause a restart loop that
 *    turns a recoverable blip into an outage.
 *  - `/ready` -- can this instance serve traffic? Depends on the database.
 *    Failing readiness removes the instance from the load balancer without
 *    killing it.
 *  - `/health` -- kept as an alias of `/ready` so existing probes and container
 *    health checks keep working unchanged.
 *
 * A health endpoint that answers 200 while the database is unreachable is worse
 * than none at all: the load balancer keeps routing to an instance whose every
 * real request will fail.
 */

export function livenessResponse() {
  return ok({ status: "live", time: new Date().toISOString() });
}

export function readinessResponse(probe: Probe = () => row("SELECT 1 AS ok")) {
  try {
    probe();
    return ok({ db: "ok", status: "ready", time: new Date().toISOString() });
  } catch {
    // Deliberately generic: the underlying error can name a filesystem path or
    // driver, and this endpoint is reachable without authentication.
    return fail("database unavailable", 503, "unavailable");
  }
}

export function healthResponse(probe: Probe = () => row("SELECT 1 AS ok")) {
  return readinessResponse(probe);
}
