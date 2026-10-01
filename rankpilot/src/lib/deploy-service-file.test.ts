import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The unit file is not exercised by anything else: systemd is not available on a
 * dev machine, and a typo in it is invisible until a deploy. These tests are
 * therefore about the properties that were actually wrong, rather than about the
 * file's general shape.
 */

const service = readFileSync(join(process.cwd(), "deploy", "rankpilot.service"), "utf8");

function execStartPreLines(): string[] {
  return service
    .split("\n")
    .filter((line) => line.startsWith("ExecStartPre="))
    .map((line) => line.trim());
}

/** The command each ExecStartPre runs, without the `ExecStartPre=` prefix. */
function execStartPreCommands(): string[] {
  return execStartPreLines().map((line) => line.slice("ExecStartPre=".length).trim());
}

describe("rankpilot.service", () => {
  it("points at documentation that exists in the repository", () => {
    // Documentation=file:/srv/rankpilot/DEPLOYMENT.md referenced a file nobody had
    // written, so the one place systemd sends an operator looking for help was
    // a 404 on the host.
    expect(service).toContain("Documentation=file:/srv/rankpilot/DEPLOYMENT.md");
    expect(readFileSync(join(process.cwd(), "DEPLOYMENT.md"), "utf8")).toContain("# DEPLOYMENT.md");
  });

  it("runs the directory-initialising preflight before the plain one", () => {
    // Order was the bug, not the presence of either line. On a first deploy the
    // data directory does not exist, and a missing directory is itself a blocker,
    // so a plain preflight exits 1 and systemd never reaches the --init-dirs
    // line: the unit could not bootstrap a fresh host at all.
    const preflights = execStartPreCommands().filter((line) => line.includes("preflight:deploy"));
    expect(preflights).toHaveLength(1);
    expect(preflights[0]).toContain("--init-dirs");
  });

  it("applies migrations as part of the start, not as a manual step", () => {
    // A deploy that starts the app without migrating serves requests against an
    // older schema, which fails at the first query touching a new column.
    expect(execStartPreLines().some((line) => line.includes("db:init"))).toBe(true);
  });

  it("fails closed before serving, rather than checking only after", () => {
    const lines = service.split("\n");
    const exec = lines.findIndex((line) => line.startsWith("ExecStart="));
    for (const pre of execStartPreLines()) {
      const at = lines.findIndex((line) => line.trim() === pre);
      expect(at, pre).toBeGreaterThan(-1);
      expect(at, pre).toBeLessThan(exec);
    }
  });

  it("does not scale horizontally, because SQLite is a single-writer store", () => {
    // Worth asserting explicitly: the natural "just add a second instance" fix is
    // the one change that corrupts data.
    expect(service).not.toMatch(/^\s*ExecStartPre=.*--workers/m);
    expect(service).toContain("Restart=always");
    expect(service).toMatch(/ProtectSystem=strict/);
  });

  it("keeps the data directory outside the read-only system tree", () => {
    expect(service).toContain("StateDirectory=rankpilot");
    expect(service).toContain("ReadWritePaths=/var/lib/rankpilot");
  });

  it("reads secrets from a root-owned file rather than inline", () => {
    expect(service).toContain("EnvironmentFile=/etc/rankpilot/rankpilot.env");
    // A secret in this file is world-readable by default under /etc/systemd.
    expect(service).not.toMatch(/AUTH_SECRET=\S/);
  });
});
