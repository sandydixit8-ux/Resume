import { test, expect } from "@playwright/test";

test.describe("public booking", () => {
  test("books a free strategy call slot from the public page", async ({ page }) => {
    await page.goto("/u/democreator/book/strategy-call");
    await expect(page.getByRole("heading", { name: "Book with Demo Creator" })).toBeVisible();
    await expect(page.getByText("30-min Strategy Call · 30 min · Free")).toBeVisible();

    // A date chip appears once availability loads (demo has Mon/Wed windows).
    const dateChip = page.getByRole("button", { name: /^(Mon|Wed)/ });
    await dateChip.first().click({ timeout: 15000 });

    // Pick the first open slot (e.g. "9:00 AM").
    const slot = page.getByRole("button", { name: /[0-9]:[0-9]{2} (AM|PM)/ });
    await slot.first().click({ timeout: 15000 });

    await page.getByPlaceholder("Your name").fill("E2E Booker");
    await page.getByPlaceholder("Email for confirmation").fill("booker-e2e@example.com");
    await page.getByRole("button", { name: /Confirm booking/ }).click();

    await expect(page.getByRole("heading", { name: "You're booked!" })).toBeVisible({ timeout: 15000 });
  });
});