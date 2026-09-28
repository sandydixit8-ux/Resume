import { test, expect } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD, register, login, logout } from "./helpers";

test.describe("auth", () => {
  test("registers a new account and lands in the dashboard", async ({ page }) => {
    const stamp = Date.now();
    await register(page, `E2E User ${stamp}`, `e2e-${stamp}@example.com`, "E2EPass12345!");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(`Welcome back, E2E User ${stamp}`)).toBeVisible();
    await expect(page.getByText(`E2E User ${stamp}`).first()).toBeVisible();
  });

  test("logs in with demo credentials and logs out", async ({ page }) => {
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await expect(page).toHaveURL(/\/app$/);

    await logout(page);
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});