import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("billing & plan upgrades", () => {
  test("upgrades to the pro plan via simulated checkout, then cancels", async ({ page }) => {
    await login(page);
    await page.goto("/app/billing");

    // Upgrade to pro.
    await page.locator('a[href="/api/billing/checkout?plan=pro"]').click();
    await expect(page).toHaveURL(/\/app\/billing/, { timeout: 20000 });
    await expect(page.getByText("You're on the pro plan.")).toBeVisible({ timeout: 15000 });

    const subBanner = page.getByText(/pro plan · active/);
    await expect(subBanner).toBeVisible();

    // Cancel subscription (status -> canceled, active plan retained per Stripe period-end semantics).
    await page.getByRole("button", { name: /cancel subscription/i }).click();
    await expect(page).toHaveURL(/\/app\/billing/, { timeout: 20000 });
    await expect(page.getByText("You're on the pro plan.")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /cancel subscription/i })).toHaveCount(0);
  });
});