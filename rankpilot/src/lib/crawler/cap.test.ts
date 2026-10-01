import { describe, expect, it, afterEach } from "vitest";
import { effectivePageCap } from "./run";
import { getLimits } from "@/lib/plans";

const ORIGINAL = process.env.CRAWLER_MAX_PAGES;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRAWLER_MAX_PAGES;
  else process.env.CRAWLER_MAX_PAGES = ORIGINAL;
});

describe("effectivePageCap", () => {
  it("caps a large request at the plan limit", () => {
    delete process.env.CRAWLER_MAX_PAGES;
    expect(effectivePageCap("free", 5000)).toBe(getLimits("free").pagesPerCrawl);
  });

  it("caps a large request at the plan limit even when the server cap is high", () => {
    process.env.CRAWLER_MAX_PAGES = "10000";
    expect(effectivePageCap("free", 5000)).toBe(getLimits("free").pagesPerCrawl);
    expect(effectivePageCap("pro", 5000)).toBe(getLimits("pro").pagesPerCrawl);
  });

  it("applies the operator cap when it is lower than the plan", () => {
    process.env.CRAWLER_MAX_PAGES = "25";
    expect(effectivePageCap("agency")).toBe(25);
  });

  it("honours a smaller explicit request", () => {
    delete process.env.CRAWLER_MAX_PAGES;
    expect(effectivePageCap("agency", 10)).toBe(10);
  });

  it("uses the plan limit when no request is supplied", () => {
    process.env.CRAWLER_MAX_PAGES = "10000";
    expect(effectivePageCap("growth")).toBe(getLimits("growth").pagesPerCrawl);
  });

  it("falls back to the free plan for an unknown plan", () => {
    delete process.env.CRAWLER_MAX_PAGES;
    expect(effectivePageCap("nonexistent-plan")).toBe(getLimits("free").pagesPerCrawl);
  });

  it("tracks plans.ts instead of a hardcoded copy", () => {
    // Raise the operator cap so the plan value is what we are actually asserting.
    process.env.CRAWLER_MAX_PAGES = "100000";
    for (const plan of ["free", "pro", "growth", "agency"] as const) {
      expect(effectivePageCap(plan)).toBe(getLimits(plan).pagesPerCrawl);
    }
  });
});
