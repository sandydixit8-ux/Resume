import { test, expect } from "@playwright/test";

const LEGAL = [
  { path: "/terms", heading: "Terms of Service", link: "Terms" },
  { path: "/privacy", heading: "Privacy Policy", link: "Privacy" },
  { path: "/refund-policy", heading: "Refund Policy", link: "Refund Policy" },
  { path: "/cookie-policy", heading: "Cookie Policy", link: "Cookie Policy" },
  { path: "/contact", heading: "Contact", link: "Contact" },
];

test.describe("legal pages & signup consent", () => {
  for (const l of LEGAL) {
    test(`serves ${l.path}`, async ({ page }) => {
      const res = await page.goto(l.path);
      expect(res?.ok()).toBeTruthy();
      await expect(page.getByRole("heading", { name: l.heading, level: 1 })).toBeVisible();
      await expect(page.getByText("This page is a placeholder.")).toBeVisible();
    });
  }

  test("landing footer links to every legal page", async ({ page }) => {
    await page.goto("/");
    for (const l of LEGAL) {
      await expect(page.getByRole("link", { name: l.link, exact: true }).first()).toBeVisible();
    }
  });

  test("registration requires consent before it will submit", async ({ page }) => {
    const stamp = Date.now();
    await page.goto("/auth/register");
    await page.fill("#name", `Consent User ${stamp}`);
    await page.fill("#email", `consent-${stamp}@example.com`);
    await page.fill("#password", "ConsentPass12345!");

    // Submitting without consent must be blocked.
    await page.click('button[type="submit"]');
    await expect(page.getByText(/Please accept the Terms of Service and Privacy Policy/i)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/register$/);

    // The consent label links to both documents.
    await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();

    await page.check("#agree");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app$/);
  });
});
