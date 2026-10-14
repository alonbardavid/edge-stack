import { test, expect, type Page } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD, TEST_NAME } from "../auth/test-user";
import {
  captureBrowserEvents,
  waitForBrowserEvent,
  waitForWorkerEvent,
} from "./events";

const SECRET_ID = "0f8fa0b4-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
const SECRET_TOKEN = "s3cr3t-reset-token";

test.describe("Analytics", () => {
  test("a sign-in is identified in the browser and recorded by the worker", async ({
    page,
  }) => {
    const events = captureBrowserEvents(page);

    await page.goto("/");
    const view = await waitForBrowserEvent(
      events,
      (event) => event.event === "$pageview",
    );
    expect(view.properties).toMatchObject({
      $pathname: "/",
      app_side: "browser",
    });

    await signIn(page);
    const identify = await waitForBrowserEvent(
      events,
      (event) => event.event === "$identify",
    );
    const userId = identify.distinctId;

    const signedIn = await waitForWorkerEvent("signed_in", userId);
    expect(JSON.parse(signedIn.properties)).toEqual({
      auth_path: "/sign-in/email",
    });

    await page.getByRole("button", { name: "Log out" }).click();
    const signedOut = await waitForBrowserEvent(
      events,
      (event) => event.event === "signed_out",
    );
    expect(signedOut.distinctId).toBe(userId);
  });

  test("a page view reports the route's shape, never its ids or query", async ({
    page,
  }) => {
    const events = captureBrowserEvents(page);

    await page.goto(`/items/${SECRET_ID}?token=${SECRET_TOKEN}`);
    const view = await waitForBrowserEvent(
      events,
      (event) => event.event === "$pageview",
    );

    expect(view.properties.$pathname).toBe("/items/:id");
    expect(view.properties.$current_url).toBe(
      "http://localhost:5173/items/:id",
    );
    const everything = events.map((event) => event.raw).join("\n");
    expect(everything).not.toContain(SECRET_ID);
    expect(everything).not.toContain(SECRET_TOKEN);
  });
});

async function signIn(page: Page) {
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: `Welcome, ${TEST_NAME}` }),
  ).toBeVisible({ timeout: 10000 });
}
