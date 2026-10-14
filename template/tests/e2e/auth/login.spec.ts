import { test, expect, Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD, TEST_NAME } from "./test-user";

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("Login flow", () => {
  test("shows login screen when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await signIn(page, `nobody_${Date.now()}@example.com`, "wrong-password");
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("logs in and shows the welcome screen", async ({ page }) => {
    await page.goto("/");
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(
      page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("returning visit keeps the user signed in", async ({ page }) => {
    await page.goto("/");
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(
      page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
    ).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(
      page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("logging out returns to the login screen", async ({ page }) => {
    await page.goto("/");
    await signIn(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(
      page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
