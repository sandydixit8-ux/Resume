import { describe, it, expect } from "vitest";
import { getLimits, withinLimit, PLANS } from "./plans";

describe("plans", () => {
  it("falls back to free for unknown plans", () => {
    expect(getLimits("nonexistent")).toBe(PLANS.free);
    expect(getLimits(undefined as unknown as string)).toBe(PLANS.free);
  });

  it("escalates limits across tiers", () => {
    const free = getLimits("free");
    const business = getLimits("business");
    expect(free.contacts).toBeLessThan(getLimits("starter").contacts);
    expect(getLimits("creator").customDomain).toBe(true);
    expect(business.contacts).toBe(-1);
  });

  it("treats -1 as unlimited in withinLimit", () => {
    expect(withinLimit(999999, -1)).toBe(true);
    expect(withinLimit(9, 10)).toBe(true);
    expect(withinLimit(10, 10)).toBe(false);
  });
});