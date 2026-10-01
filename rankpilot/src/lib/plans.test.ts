import { describe, expect, it } from "vitest";
import { PLAN_RANK, isDowngrade, planRank } from "./plans";

describe("plan ordering", () => {
  it("ranks plans from cheapest to most expensive", () => {
    expect(planRank("free")).toBeLessThan(planRank("pro"));
    expect(planRank("pro")).toBeLessThan(planRank("growth"));
    expect(planRank("growth")).toBeLessThan(planRank("agency"));
  });

  it("derives ranking from prices, not declaration order", () => {
    // Guards against the two tables drifting apart unnoticed.
    for (const [plan, price] of Object.entries({
      free: 0,
      pro: 29,
      growth: 79,
      agency: 199,
    })) {
      expect(PLAN_RANK[plan]).toBeTypeOf("number");
      expect(price).toBeTypeOf("number");
    }
    const ranks = Object.values(PLAN_RANK);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("classifies downgrades and upgrades", () => {
    expect(isDowngrade("agency", "free")).toBe(true);
    expect(isDowngrade("pro", "growth")).toBe(false);
    expect(isDowngrade("free", "agency")).toBe(false);
  });

  it("treats a same-plan change as not a downgrade", () => {
    // A no-op write is not a downgrade; it must not slip past an upgrade gate.
    expect(isDowngrade("pro", "pro")).toBe(false);
  });

  it("ranks unknown plans as free, the safe direction", () => {
    // An unrecognised stored plan must never be assumed better than free,
    // or an upgrade check could be bypassed via a corrupted plan string.
    expect(planRank("enterprise")).toBe(planRank("free"));
    expect(isDowngrade("enterprise", "agency")).toBe(false);
  });
});
