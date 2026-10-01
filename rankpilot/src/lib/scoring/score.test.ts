import { describe, expect, it } from "vitest";
import { computeScore, COMPONENT_WEIGHTS } from "@/lib/scoring/score";
import type { CheckOutcome } from "@/lib/seo/types";

function mk(over: Partial<CheckOutcome> = {}): CheckOutcome {
  return {
    code: "T001",
    category: "technical",
    severity: "high",
    title: "test check",
    whyItMatters: "",
    recommendation: "",
    weight: 10,
    applicable: 1,
    failures: [],
    ...over,
  };
}

describe("computeScore", () => {
  it("scores a component as weighted pass ratio", () => {
    const outcomes = [
      mk({ code: "A", weight: 10, applicable: 2, failures: [{ detail: "one" }] }), // 50%
      mk({ code: "B", weight: 10, applicable: 2, failures: [] }), // 100%
    ];
    const result = computeScore(outcomes, null);
    expect(result.components.technical.score).toBe(75);
    expect(result.overall).toBe(75);
  });

  it("renormalizes weights over components that have data", () => {
    const outcomes = [
      mk({ code: "A", weight: 10, applicable: 2, failures: [{ detail: "x" }] }), // 50%
      mk({ code: "B", weight: 10, applicable: 2, failures: [] }), // 100%
      mk({ code: "C", category: "onpage", weight: 10, applicable: 1, failures: [{ detail: "x" }] }), // 0%
    ];
    const result = computeScore(outcomes, null);
    expect(result.components.technical.score).toBe(75);
    expect(result.components.onpage.score).toBe(0);
    // (75 * .2 + 0 * .2) / .4 = 37.5 → 38
    expect(result.overall).toBe(38);
    expect(result.components.technical.weightApplied).toBeCloseTo(0.5, 5);
  });

  it("excludes checks that are not applicable to the crawl", () => {
    const outcomes = [
      mk({ code: "A", weight: 10, applicable: 0, failures: [] }),
      mk({ code: "B", weight: 5, applicable: 3, failures: [] }),
    ];
    const result = computeScore(outcomes, null);
    expect(result.components.technical.score).toBe(100);
    expect(result.overall).toBe(100);
  });

  it("never fabricates a score when there is no data", () => {
    const result = computeScore([], null);
    expect(result.overall).toBe(0);
    expect(result.components).toEqual({});
    expect(result.methodology.components).toEqual([]);
  });

  it("adds the authority component only when pages were measured", () => {
    const withAuthority = computeScore([], { linked: 1, total: 4 });
    expect(withAuthority.components.authority.score).toBe(25);

    const without = computeScore([], { linked: 0, total: 0 });
    expect(without.components.authority).toBeUndefined();
  });

  it("keeps weight renormalization consistent when authority is present", () => {
    const outcomes = [mk({ code: "A", weight: 10, applicable: 1, failures: [] })]; // 100 technical
    const result = computeScore(outcomes, { linked: 2, total: 2 }); // 100 authority
    const measuredWeight = COMPONENT_WEIGHTS.technical + COMPONENT_WEIGHTS.authority;
    expect(result.components.technical.weightApplied).toBeCloseTo(
      COMPONENT_WEIGHTS.technical / measuredWeight,
      5
    );
    expect(result.overall).toBe(100);
  });

  it("publishes its methodology so the number is explainable", () => {
    const result = computeScore([mk()], null);
    expect(result.methodology.formula).toContain("weighted average");
    expect(result.methodology.componentFormula).toContain("passRatio");
    expect(result.methodology.weights).toEqual(COMPONENT_WEIGHTS);
    expect(result.methodology.components[0].checks[0].code).toBe("T001");
  });
});
