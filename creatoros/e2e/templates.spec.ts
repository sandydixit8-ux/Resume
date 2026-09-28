import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("template library", () => {
  test("browses templates and applies a free one into the editor", async ({ page }) => {
    await login(page);
    await page.goto("/app/templates");
    await expect(page.getByRole("heading", { name: "Template Library" })).toBeVisible();

    await expect(page.getByText("Link-in-Bio Starter")).toBeVisible();
    await expect(page.getByText("Viral Content Kit")).toBeVisible();

    await page.getByRole("link", { name: "creator" }).click();
    await expect(page.getByRole("heading", { name: "Template Library" })).toBeVisible();
    await expect(page.getByText("Link-in-Bio Starter")).toHaveCount(0);
    await expect(page.getByText("Course Creator")).toBeVisible();
  });

  test("applies a template and lands in the page editor", async ({ page }) => {
    await login(page);
    await page.goto("/app/templates");

    const card = page.getByRole("button", { name: /Start from template/ }).first();
    await card.click();

    await expect(page).toHaveURL(/\/app\/bio\/bio_/);
    await expect(page.getByRole("heading", { name: "Edit bio page" })).toBeVisible();
  });
});