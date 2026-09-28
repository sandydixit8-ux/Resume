import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@creatoros.dev";
export const DEMO_PASSWORD = "Demo1234!";

export async function login(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
  await page.goto("/auth/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app$/);
}

export async function logout(page: Page) {
  await page.goto("/app");
  await page.getByRole("button", { name: /log out/i }).click();
  await page.goto("/auth/login");
}

export async function register(page: Page, name: string, email: string, password: string) {
  await page.goto("/auth/register");
  await page.fill("#name", name);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app$/);
}