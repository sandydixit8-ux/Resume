import { test, expect } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { register, logout } from "./helpers";

/**
 * In E2E the mailer runs in "log" mode and writes each message to
 * data/emails/*.html, so the reset link can be read straight from disk. This
 * keeps the test hermetic: no real email is sent and no production key is used.
 */
async function waitForResetToken(email: string): Promise<string> {
  const dir = join(process.cwd(), "data", "emails");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        const content = await readFile(join(dir, file), "utf8");
        if (!content.includes(`to: ${email}`)) continue;
        const match = content.match(/reset-password\?token=([^"&\s]+)/);
        if (match) return decodeURIComponent(match[1]);
      }
    } catch {
      // emails directory has not been created yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No password reset email found for ${email}`);
}

test.describe("password reset", () => {
  test("requests a link, sets a new password, then logs in with it", async ({ page }) => {
    const stamp = Date.now();
    const email = `reset-${stamp}@example.com`;

    await register(page, `Reset User ${stamp}`, email, "OriginalPass12345!");
    await logout(page);

    await page.goto("/auth/forgot-password");
    await page.fill("#email", email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/a reset link is on its way/i)).toBeVisible();

    const token = await waitForResetToken(email);
    await page.goto(`/auth/reset-password?token=${encodeURIComponent(token)}`);
    await page.fill("#password", "BrandNewPass12345!");
    await page.fill("#confirm", "BrandNewPass12345!");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?reset=1/);

    await page.fill("#email", email);
    await page.fill("#password", "BrandNewPass12345!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app$/);
  });
});
