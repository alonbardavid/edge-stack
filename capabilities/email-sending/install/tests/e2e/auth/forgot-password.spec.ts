import { test, expect, Page } from "@playwright/test";
import {
  openEmail,
  waitForResetPasswordEmail,
  waitForVerificationEmail,
} from "../email";

const OLD_PASSWORD = "supersecret123";
const NEW_PASSWORD = "brandnewsecret456";

async function signUpAndVerify(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(OLD_PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible({ timeout: 10000 });

  const { url } = await waitForVerificationEmail(email);
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: `Welcome, ${name}` }),
  ).toBeVisible({ timeout: 10000 });
}

test.describe("Forgot password flow", () => {
  test("can navigate from login to forgot password", async ({ page }) => {
    await page.goto("/");
    await expect(async () => {
      await page.getByRole("link", { name: "Forgot password?" }).click();
      await expect(
        page.getByRole("heading", { name: "Forgot your password?" }),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 10000 });
  });

  test("resets the password via the emailed link and signs in", async ({
    page,
  }) => {
    const email = `reset_${Date.now()}@example.com`;
    await signUpAndVerify(page, "Reset User", email);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(
      page.getByRole("heading", { name: "Sign in" }),
    ).toBeVisible({ timeout: 10000 });

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeVisible({ timeout: 10000 });

    const message = await waitForResetPasswordEmail(email);
    expect(message.subject).toBe("Reset your password");

    const inbox = await openEmail(page.context(), message);
    await expect(
      inbox.getByText("Reset your password", { exact: true }),
    ).toBeVisible();
    await expect(
      inbox.getByText(
        "Hi Reset User, we received a request to reset the password for your project-name account. Click the button below to choose a new password.",
      ),
    ).toBeVisible();
    const resetLink = inbox.getByRole("link", { name: "Reset password" });
    await expect(resetLink).toHaveAttribute(
      "href",
      /^http:\/\/localhost:5173\/api\/auth\/reset-password\/.+/,
    );
    await inbox.close();

    await page.goto(message.url);
    await expect(
      page.getByRole("heading", { name: "Choose a new password" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByLabel("New password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(
      page.getByRole("heading", { name: "Password updated" }),
    ).toBeVisible({ timeout: 10000 });

    await page.goto("/");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome, Reset User" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
