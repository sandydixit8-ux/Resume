import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("billing & plan upgrades", () => {
  test("upgrades to the pro plan via simulated checkout, then cancels", async ({ page }) => {
    await login(page);
    await page.goto("/app/billing");

    // Upgrade to pro. The checkout is started with a POST (Stripe returns a
    // hosted URL, Cashfree opens the browser SDK), so the card exposes a button.
    const proCard = page.locator("div.card", { has: page.getByRole("heading", { name: "pro", exact: true }) });
    await proCard.getByRole("button", { name: /upgrade/i }).click();
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