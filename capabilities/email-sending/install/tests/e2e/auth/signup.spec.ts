import { test, expect, Page } from "@playwright/test";
import { clickEmailLink, openEmail, waitForVerificationEmail } from "../email";

const PASSWORD = "supersecret123";

async function submitSignUp(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible({ timeout: 10000 });
}

test.describe("Sign up flow", () => {
  test("can navigate from login to sign up", async ({ page }) => {
    await page.goto("/");
    await expect(async () => {
      await page.getByRole("link", { name: "Sign up" }).click();
      await expect(
        page.getByRole("heading", { name: "Create your account" }),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 10000 });
  });

  test("signs up, verifies via the emailed link, and lands signed in", async ({
    page,
  }) => {
    const email = `signup_${Date.now()}@example.com`;
    await submitSignUp(page, "New User", email);

    const message = await waitForVerificationEmail(email);
    expect(message.subject).toBe("Verify your email address");
    expect(message.fromName).toBe("project-name");

    const inbox = await openEmail(page.context(), message);
    await expect(inbox.getByText("project-name", { exact: true })).toBeVisible();
    await expect(
      inbox.getByText("Verify your email", { exact: true }),
    ).toBeVisible();
    await expect(
      inbox.getByText(
        "Hi New User, thanks for signing up. Confirm your email address to activate your project-name account.",
      ),
    ).toBeVisible();
    await expect(
      inbox.getByText(
        "You received this email because this address was used to sign up for project-name.",
      ),
    ).toBeVisible();
    const verifyLink = inbox.getByRole("link", {
      name: "Verify email address",
    });
    await expect(verifyLink).toHaveAttribute(
      "href",
      /^http:\/\/localhost:5173\/api\/auth\/verify-email\?token=.+/,
    );

    const verified = await clickEmailLink(inbox, "Verify email address");
    await inbox.close();
    await expect(
      verified.getByRole("heading", { name: "Welcome, New User" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("shows an error when signing up with an already-used email", async ({
    page,
  }) => {
    const email = `duplicate_${Date.now()}@example.com`;
    await submitSignUp(page, "First User", email);

    await page.goto("/signup");
    await page.getByLabel("Name").fill("Second User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.getByText(/already in use/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { name: "Check your inbox" }),
    ).toBeHidden();
  });

  test("cannot sign in before verifying the email", async ({ page }) => {
    const email = `unverified_${Date.now()}@example.com`;
    await submitSignUp(page, "Unverified User", email);

    await page.goto("/");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/email not verified/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
