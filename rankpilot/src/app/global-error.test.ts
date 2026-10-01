import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Root error boundary.
 *
 * There was no boundary at all, so any unhandled render error produced
 * Next.js's built-in page with no recovery path. These assertions are
 * structural because the project has no DOM test environment, and the failure
 * mode being guarded here is "the file was deleted or neutered" -- which is
 * exactly what source assertions detect.
 */
const source = readFileSync(join(process.cwd(), "src", "app", "global-error.tsx"), "utf8");

describe("root error boundary", () => {
  it("is a client component", () => {
    expect(source).toMatch(/^\s*["']use client["']/);
  });

  it("exports a default error component taking error and reset", () => {
    expect(source).toContain("export default function GlobalError");
    expect(source).toMatch(/error:/);
    expect(source).toMatch(/reset:/);
  });

  it("renders its own html and body", () => {
    // global-error replaces the root layout entirely, so omitting these
    // produces a hydration error and a blank page instead of a recovery UI.
    expect(source).toContain("<html");
    expect(source).toContain("<body");
    expect(source).toContain("lang=\"en\"");
  });

  it("offers a retry that calls reset", () => {
    expect(source).toContain("onClick={reset}");
    expect(source).toContain("Try again");
  });

  it("never renders the raw error message to the user", () => {
    // The message can contain file paths, SQL, or provider detail. It belongs
    // in the logs, not on the page.
    const rendered = source.replace(/console\.error\([\s\S]*?\);/, "");
    expect(rendered).not.toMatch(/\{error\.message\}/);
    expect(rendered).not.toMatch(/\{error\.stack\}/);
  });

  it("shows a support reference instead", () => {
    expect(source).toContain("error.digest");
    expect(source).toMatch(/Reference for support/);
  });

  it("logs the failure with the digest, which is the real correlation key", () => {
    expect(source).toContain("console.error");
    expect(source).toMatch(/digest/);
    expect(source).toMatch(/unhandled_render_error/);
  });

  it("offers a retry", () => {
    expect(source).toMatch(/Try again/);
  });

  it("does not claim the user's data is safe, which it cannot know", () => {
    // Regression: the boundary previously said "Your data has not been
    // affected". A render error can follow a committed write, so this asserts
    // the unverifiable reassurance is gone.
    expect(source).not.toMatch(/data has not been affected/i);
    expect(source).not.toMatch(/your data is safe/i);
    expect(source).not.toMatch(/nothing was lost/i);
    // It should still tell the reader what to do about an uncertain write.
    expect(source).toMatch(/duplicate/i);
  });
});
