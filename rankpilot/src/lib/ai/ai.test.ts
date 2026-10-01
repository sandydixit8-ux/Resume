import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const worker = process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "1";
process.env.RANKPILOT_DB_PATH = join(
  process.env.RANKPILOT_TEST_DIR ?? mkdtempSync(join(tmpdir(), "rankpilot-test-")),
  `ai-${worker}.db`
);

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { newId, nowIso, run } from "@/lib/db/db";
import { getUsage } from "@/lib/usage";
import { scrubClaims, scrubUngroundedNumbers, guardrailPass } from "./guardrails";
import { executeTask, QuotaExceededError, setProvider } from "./index";
import { NullProvider } from "./provider";
import type { AIProvider, GenerateResult } from "./types";

function makeOrg(): string {
  const id = newId("org");
  const now = nowIso();
  run(
    "INSERT INTO organizations (id, name, slug, plan, mode, created_at, updated_at) VALUES (?, 'T', ?, 'free', 'individual', ?, ?)",
    id,
    `t-${id.slice(-6)}`,
    now,
    now
  );
  return id;
}

let tenant = "";

beforeAll(() => {
  tenant = makeOrg();
  setProvider(new NullProvider());
});

afterAll(() => {
  setProvider(null);
});

describe("guardrails", () => {
  it("removes guarantee-style claims", () => {
    const { text, removed } = scrubClaims(
      "We guarantee rankings on the first page of Google."
    );
    expect(removed.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/guarantee/i);
    expect(text).not.toMatch(/first page of google/i);
  });

  it("replaces numbers absent from context with Data unavailable", () => {
    const out = scrubUngroundedNumbers(
      "You get 12 clicks from 45 searches (2024).",
      '{"volume":12}'
    );
    expect(out).toContain("12");
    expect(out).toContain("Data unavailable");
    expect(out).not.toContain("45");
    expect(out).toContain("2024");
  });

  it("guardrailPass combines both", () => {
    const r = guardrailPass("Guaranteed #1 ranking with 99% success.", "{}");
    expect(r.text).not.toMatch(/guaranteed/i);
    expect(r.text).toMatch(/Data unavailable/);
  });
});

describe("executeTask without AI provider", () => {
  it("falls back to rules output for geo recommendations", async () => {
    const res = await executeTask<{ recommendations: Array<{ title: string }> }>("geo.recommendations", {
      tenantId: tenant,
      plan: "free",
    });
    expect(res.source).toBe("rules");
    expect(res.degraded).toBeTruthy();
    expect(res.data.recommendations.length).toBeGreaterThan(0);
  });

  it("answers copilot from observed data only", async () => {
    const res = await executeTask<{ observed: string[]; missingData: string[]; interpretation: string; recommendation: string }>("copilot.answer", {
      tenantId: tenant,
      plan: "free",
      render: { question: "what should I fix first?" },
    });
    expect(res.data.observed.length).toBeGreaterThan(0);
    expect(res.data.missingData.length).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(res.data)).not.toMatch(/guarantee/i);
  });

  it("generates social ideas without invented metrics", async () => {
    const res = await executeTask<{ ideas: Array<Record<string, string>> }>("social.ideas", {
      tenantId: tenant,
      plan: "free",
      social: true,
      brief: { name: "RankPilot", objective: "traffic" },
    });
    expect(res.data.ideas.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.data)).not.toMatch(/\d+% /);
  });

  it("enforces AI quota", async () => {
    for (let i = 0; i < 15; i++) {
      run(
        `INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES (?, ?, 'aiGenerations', ?, 1)
         ON CONFLICT(tenant_id, metric, period) DO UPDATE SET used = used + 1`,
        newId("pu"),
        tenant,
        new Date().toISOString().slice(0, 7)
      );
    }
    await expect(
      executeTask<{ suggestion: string }>("issue.fix", { tenantId: tenant, plan: "free" })
    ).rejects.toThrow(QuotaExceededError);
    expect(getUsage(tenant, "aiGenerations")).toBeGreaterThanOrEqual(15);
  });
});

/** A provider that answers with schema-valid JSON, so runTask reaches the metered `ok` path. */
class StubProvider implements AIProvider {
  readonly name = "stub";
  readonly available = true;
  constructor(private readonly payload: unknown) {}
  async generate(): Promise<GenerateResult> {
    return {
      text: JSON.stringify(this.payload),
      usage: { tokensIn: 100, tokensOut: 50 },
      durationMs: 5,
    };
  }
}

describe("quota accounting on the metered path", () => {
  it("bills social generations to socialGenerations, not aiGenerations", async () => {
    const org = makeOrg();
    setProvider(
      new StubProvider({
        ideas: [
          {
            category: "How-to",
            title: "t",
            hook: "h",
            painPoint: "p",
            emotionalAngle: "e",
            format: "f",
            value: "v",
            cta: "c",
          },
        ],
      })
    );
    try {
      const res = await executeTask<{ ideas: unknown[] }>("social.ideas", {
        tenantId: org,
        plan: "free",
        social: true,
        brief: { name: "RankPilot", objective: "traffic" },
      });
      expect(res.source).toBe("ai");
      expect(getUsage(org, "socialGenerations")).toBe(1);
      expect(getUsage(org, "aiGenerations")).toBe(0);
    } finally {
      setProvider(new NullProvider());
    }
  });

  it("blocks a social task once the social quota is spent", async () => {
    const org = makeOrg();
    const period = new Date().toISOString().slice(0, 7);
    run(
      `INSERT INTO plans_usage (id, tenant_id, metric, period, used) VALUES (?, ?, 'socialGenerations', ?, 15)
       ON CONFLICT(tenant_id, metric, period) DO UPDATE SET used = 15`,
      newId("pu"),
      org,
      period
    );
    await expect(
      executeTask<{ ideas: unknown[] }>("social.ideas", {
        tenantId: org,
        plan: "free",
        social: true,
        brief: { name: "RankPilot" },
      })
    ).rejects.toThrow(QuotaExceededError);
  });

  it("does not spend quota when the provider is missing and rules run", async () => {
    const org = makeOrg();
    setProvider(new NullProvider());
    await executeTask<{ ideas: unknown[] }>("social.ideas", {
      tenantId: org,
      plan: "free",
      social: true,
      brief: { name: "RankPilot" },
    });
    expect(getUsage(org, "socialGenerations")).toBe(0);
  });
});
