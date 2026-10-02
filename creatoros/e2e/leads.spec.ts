import { test, expect } from "@playwright/test";

test.describe("lead capture", () => {
  test("captures a bio-page lead only after consent is given", async ({ page }) => {
    await page.goto("/u/democreator");

    const capture = page.locator("form", { hasText: "Get free creator monetization tips" });
    await expect(capture).toBeVisible();

    await capture.getByPlaceholder("you@example.com").fill(`lead-${Date.now()}@example.com`);

    // Consent is required: the first submit must be rejected.
    await capture.getByRole("button", { name: "Subscribe" }).click();
    await expect(capture.getByText("Please agree to receive updates.")).toBeVisible();

    // With consent the lead is stored and the success state replaces the form.
    await capture.getByRole("checkbox").check();
    await capture.getByRole("button", { name: "Subscribe" }).click();
    await expect(page.getByText("Subscribed! Check your inbox.")).toBeVisible();
  });
});
