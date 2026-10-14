import { test, expect, type Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD, TEST_NAME } from "../auth/test-user";

const privacyLink = (page: Page) =>
  page.getByRole("link", { name: "Privacy", exact: true });

test.describe("Privacy policy", () => {
  test("is linked from the sign-in screen and explains, with no controls", async ({
    page,
  }) => {
    await page.goto("/");
    await privacyLink(page).click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { name: "Privacy", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "What we collect" }),
    ).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(privacyLink(page)).toHaveCount(0);

    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("is linked from the signed-in app too", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
    ).toBeVisible({ timeout: 10000 });

    await privacyLink(page).click();
    await expect(
      page.getByRole("heading", { name: "Privacy", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to the app" }).click();
    await expect(
      page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
    ).toBeVisible();
  });
});
