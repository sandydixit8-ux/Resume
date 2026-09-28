import { test, expect } from "@playwright/test";
import { DEMO_EMAIL, DEMO_PASSWORD, login } from "./helpers";

test.describe("course enrollment & learning", () => {
  test("enrolls publicly, completes lessons and earns a certificate", async ({ page }) => {
    // Public enrollment using the demo user's email so it shows up in their learning dashboard.
    await page.goto("/u/democreator/courses/e2e-course");
    await expect(page.getByRole("heading", { name: "E2E Course" })).toBeVisible();
    await expect(page.getByText("2 lessons")).toBeVisible();

    await page.getByPlaceholder("Your email").fill(DEMO_EMAIL);
    await page.getByRole("button", { name: "Enroll free" }).click();
    await expect(page.getByText("You're enrolled!")).toBeVisible();

    // Log in and open the course from My learning.
    await login(page, DEMO_EMAIL, DEMO_PASSWORD);
    await page.goto("/app/learn");
    await expect(page.getByText("E2E Course")).toBeVisible();
    await page.getByText("E2E Course").click();
    await expect(page).toHaveURL(/\/app\/learn\/enr_/);

    // Complete the text lesson.
    await page.getByRole("button", { name: "Mark as complete" }).click();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible({ timeout: 15000 });

    // Move to the quiz lesson and answer correctly.
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page.getByText("What is 2 + 2?")).toBeVisible();
    await page.getByRole("button", { name: /4/ }).click();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByText("Correct! Lesson completed.")).toBeVisible({ timeout: 15000 });

    // Completion banner + certificate.
    await expect(page.getByText("Course completed!")).toBeVisible({ timeout: 15000 });
    await page.getByRole("link", { name: "View certificate" }).click();
    await expect(page).toHaveURL(/\/app\/learn\/enr_.*\/certificate$/);
    await expect(page.getByText("Certificate of Completion")).toBeVisible();
    await expect(page.getByRole("heading", { name: "E2E Course" })).toBeVisible();
  });
});