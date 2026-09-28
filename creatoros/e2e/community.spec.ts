import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("community", () => {
  test("creates a community, posts, reacts and comments", async ({ page }) => {
    await login(page);
    await page.goto("/app/community");
    await expect(page.getByRole("heading", { name: "Community", exact: true })).toBeVisible();

    await page.getByPlaceholder("Community name").fill("E2E Beta");
    await page.getByPlaceholder("What is this space about?").fill("Test space for the E2E suite.");
    await page.getByRole("button", { name: "Create community" }).click();

    await expect(page).toHaveURL(/\/app\/community\/com_/);
    await expect(page.getByRole("heading", { name: "E2E Beta" })).toBeVisible();

    await page.getByPlaceholder("Share an update with your community…").fill("First post!");
    await page.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("First post!")).toBeVisible();

    await page.getByRole("button", { name: "React to this post" }).click();
    await expect(page.getByRole("button", { name: "React to this post" })).toContainText("1");

    await page.getByRole("button", { name: "Show comments for this post" }).first().click();
    await page.getByPlaceholder("Write a comment…").fill("Great point");
    await page.getByPlaceholder("Write a comment…").press("Enter");
    await expect(page.getByText("Great point")).toBeVisible();
  });
});