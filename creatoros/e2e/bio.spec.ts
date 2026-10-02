import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("bio page create & publish", () => {
  test("publishes a new bio page and serves it at its public slug URL", async ({ page }) => {
    await login(page);

    const stamp = Date.now();
    const slug = `e2e-${stamp}`;

    // Create a draft page with a unique slug.
    const createRes = await page.request.post("/api/bio", { data: { title: `E2E Page ${stamp}`, slug } });
    expect(createRes.ok()).toBeTruthy();
    const { pageId } = (await createRes.json()).data as { pageId: string };

    try {
      // Publish it from the editor.
      await page.goto(`/app/bio/${pageId}`);
      await expect(page.getByRole("heading", { name: "Edit bio page" })).toBeVisible();
      await page.getByLabel("Publish this page (visible to public)").check();
      await page.getByRole("button", { name: "Save changes" }).click();

      // Wait for the save to persist server-side (dev route compilation can be slow).
      await expect
        .poll(
          async () => {
            const res = await page.request.get("/api/bio");
            const data = (await res.json()).data as { pages: Array<{ id: string; published: number }> };
            return Boolean(data.pages.find((p) => p.id === pageId)?.published);
          },
          { timeout: 30000 }
        )
        .toBe(true);

      const bioRes = await page.request.get("/api/bio");
      const { profile } = (await bioRes.json()).data as { profile: { username: string } };

      // The published page is now publicly reachable at /u/<username>/<slug>.
      await page.goto(`/u/${profile.username}/${slug}`);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`E2E Page ${stamp}`));
    } finally {
      await page.request.delete(`/api/bio/${pageId}`);
    }
  });
});
