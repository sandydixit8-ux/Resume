import { describe, expect, it } from "vitest";
import { computeLeadScore } from "@/lib/scoring";

describe("computeLeadScore", () => {
  it("returns COLD for a fresh, low-value, uncontacted lead", () => {
    const result = computeLeadScore({ source: "Website", value: 1000, interactions: 0, lastContactedDaysAgo: null });
    expect(result.band).toBe("COLD");
    expect(result.score).toBeLessThan(50);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("returns HOT for referral + high value + recent contact + follow-up", () => {
    const result = computeLeadScore({
      source: "Referral",
      value: 600000,
      interactions: 7,
      lastContactedDaysAgo: 1,
      priority: "HOT",
      hasNextFollowup: true,
    });
    expect(result.band).toBe("HOT");
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("returns WARM for mid signals", () => {
    const result = computeLeadScore({ source: "WhatsApp", value: 120000, interactions: 3, lastContactedDaysAgo: 4, priority: "WARM" });
    expect(result.band).toBe("WARM");
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(80);
  });

  it("clamps score to 0..100", () => {
    const high = computeLeadScore({ source: "Referral", value: 900000, interactions: 9, lastContactedDaysAgo: 0, priority: "HOT", hasNextFollowup: true });
    const stale = computeLeadScore({ source: "Website", value: 1000, interactions: 0, lastContactedDaysAgo: 60, priority: "COLD" });
    expect(high.score).toBeLessThanOrEqual(100);
    expect(stale.score).toBeGreaterThanOrEqual(0);
  });

  it("penalises stale leads that were not contacted for 30+ days", () => {
    const fresh = computeLeadScore({ source: "Website", value: 50000, interactions: 1, lastContactedDaysAgo: 1 });
    const stale = computeLeadScore({ source: "Website", value: 50000, interactions: 1, lastContactedDaysAgo: 45 });
    expect(stale.score).toBeLessThan(fresh.score);
    expect(stale.reasons.some((r) => r.includes("-10"))).toBe(true);
  });

  it("uses a default source weight for unknown sources", () => {
    const result = computeLeadScore({ source: "Trade Show", interactions: 0, lastContactedDaysAgo: null });
    expect(result.score).toBe(5);
  });
});
