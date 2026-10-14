import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  captureBrowserEvents,
  waitForBrowserEvent,
  waitForWorkerEvent,
} from "../analytics/events";
import {
  ADMIN,
  createPerson,
  DEVICE_TRACKING_KEY,
  DO_NOT_SELL_LABEL,
  fromCalifornia,
  fromGermany,
  posthogStored,
  readStorage,
  seedStaleDecision,
  signInAs,
  storedTracking,
} from "./consent-state";

const banner = (page: Page) => page.getByTestId("consent-banner");

const analyticsSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Product analytics" });

const doNotSellSwitch = (page: Page) =>
  page.getByRole("switch", {
    name: "Do not sell or share my personal information",
  });

// Resolves once the app has saved a tracking change for the signed-in account.
const trackingSaved = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/privacy/tracking") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );

const toggleDoNotSell = async (page: Page) => {
  await expect(doNotSellSwitch(page)).toBeEnabled();
  const saved = trackingSaved(page);
  await page
    .getByText("Do not sell or share my personal information", { exact: true })
    .click();
  await saved;
};

test.describe("Privacy config", () => {
  test("answers a visitor with no session for their region", async ({
    page,
  }) => {
    await fromGermany(page);
    const response = await page.request.get("/api/public/privacy-config");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      regime: "EU",
      defaultTracking: "server-only",
      tracking: null,
    });
  });

  test("answers DEFAULT where no special rules apply", async ({ page }) => {
    const response = await page.request.get("/api/public/privacy-config");
    expect(await response.json()).toMatchObject({
      regime: "DEFAULT",
      defaultTracking: "enabled",
    });
  });
});

test.describe("Consent banner", () => {
  test.beforeEach(async ({ page }) => {
    await fromGermany(page);
  });

  test("asks before storing anything and stays silent until answered", async ({
    page,
  }) => {
    const events = captureBrowserEvents(page);
    await page.goto("/");

    await expect(banner(page)).toBeVisible();
    await expect(banner(page).getByText(/essential cookies/)).toBeVisible();
    expect(await posthogStored(page)).toBe(false);
    expect(events).toHaveLength(0);
  });

  test("accepting starts tracking this device", async ({ page }) => {
    const events = captureBrowserEvents(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Accept" }).click();

    await expect(banner(page)).toBeHidden();
    await waitForBrowserEvent(
      events,
      (event) => event.event === "consent_answered",
    );
    expect(await readStorage(page, DEVICE_TRACKING_KEY)).toBe("enabled");
    expect(await posthogStored(page)).toBe(true);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  test("declining keeps the device clean and sends nothing from the browser", async ({
    page,
  }) => {
    const events = captureBrowserEvents(page);
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Decline" }).click();

    await expect(banner(page)).toBeHidden();
    expect(await readStorage(page, DEVICE_TRACKING_KEY)).toBe("server-only");
    expect(await posthogStored(page)).toBe(false);

    await page.getByRole("link", { name: "Privacy", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Privacy", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(500);
    expect(events).toHaveLength(0);
  });

  test("asks again once the policy has been revised", async ({ page }) => {
    await seedStaleDecision(page, "enabled");
    await page.goto("/");
    await expect(banner(page)).toBeVisible();
  });

  test("a decision made before signing in follows the account", async ({
    page,
    request,
  }) => {
    const person = await createPerson(request, "Euro");
    await page.goto("/");
    await banner(page).getByRole("button", { name: "Decline" }).click();
    const saved = trackingSaved(page);
    await signInAs(page, person);
    await saved;

    await expect
      .poll(() => storedTracking(request, person))
      .toBe("server-only");
    await page.goto("/privacy/settings");
    await expect(analyticsSwitch(page)).not.toBeChecked();
    await expect(analyticsSwitch(page)).toBeEnabled();
  });
});

test.describe("Outside the EU", () => {
  test("no banner, and the page view is tracked by default", async ({
    page,
  }) => {
    const events = captureBrowserEvents(page);
    await page.goto("/");
    await waitForBrowserEvent(events, (event) => event.event === "$pageview");
    await expect(banner(page)).toHaveCount(0);
  });
});

test.describe("Privacy settings", () => {
  test("turning browser tracking off is recorded against the account", async ({
    page,
    request,
  }) => {
    const person = await createPerson(request, "Settler");
    await signInAs(page, person);

    await page
      .getByRole("link", { name: "Privacy settings", exact: true })
      .click();
    await expect(analyticsSwitch(page)).toBeChecked();
    await expect(analyticsSwitch(page)).toBeEnabled();
    const saved = trackingSaved(page);
    await page.getByText("Product analytics", { exact: true }).click();
    await saved;

    await expect(analyticsSwitch(page)).not.toBeChecked();
    await expect
      .poll(() => storedTracking(request, person))
      .toBe("server-only");
    expect(await posthogStored(page)).toBe(false);
    await expect(
      page.getByRole("link", { name: DO_NOT_SELL_LABEL }),
    ).toHaveCount(0);
  });
});

test.describe("California opt-out", () => {
  test.beforeEach(async ({ page }) => {
    await fromCalifornia(page);
  });

  test("opting out is recorded and holds the analytics switch off", async ({
    page,
    request,
  }) => {
    const person = await createPerson(request, "Cali");
    await signInAs(page, person);

    await page.goto("/privacy/settings");
    await page.getByRole("link", { name: DO_NOT_SELL_LABEL }).click();
    await expect(doNotSellSwitch(page)).not.toBeChecked();
    await toggleDoNotSell(page);
    await expect(doNotSellSwitch(page)).toBeChecked();
    await expect.poll(() => storedTracking(request, person)).toBe("disabled");

    await page.goto("/privacy/settings");
    await expect(analyticsSwitch(page)).toBeDisabled();
    await expect(analyticsSwitch(page)).not.toBeChecked();
    await expect(page.getByTestId("analytics-switch-note")).toContainText(
      "Do Not Sell or Share is on",
    );

    await page.goto("/do-not-sell");
    await toggleDoNotSell(page);
    await expect.poll(() => storedTracking(request, person)).toBe("enabled");
    await page.goto("/privacy/settings");
    await expect(analyticsSwitch(page)).toBeEnabled();
    await expect(analyticsSwitch(page)).toBeChecked();
  });

  test("a decision made on one device shows on the next", async ({
    page,
    browser,
    request,
  }) => {
    const person = await createPerson(request, "Two Devices");
    await signInAs(page, person);
    await page.goto("/do-not-sell");
    await toggleDoNotSell(page);
    await expect.poll(() => storedTracking(request, person)).toBe("disabled");

    const second = await browser.newContext();
    const other = await second.newPage();
    await signInAs(other, person);
    await other.goto("/privacy/settings");
    await expect(analyticsSwitch(other)).not.toBeChecked();
    await expect(analyticsSwitch(other)).toBeDisabled();
    await second.close();
  });
});

test.describe("Tracking per account", () => {
  test("an admin can set anyone's tracking, and the app reads it back", async ({
    page,
    request,
  }) => {
    const person = await createPerson(request, "Tracked");
    const set = await request.put(
      `${ADMIN}/api/admin/users/${person.id}/tracking`,
      { data: { tracking: "server-only" } },
    );
    expect(set.status()).toBe(200);
    await expect
      .poll(() => storedTracking(request, person))
      .toBe("server-only");

    await signInAs(page, person);
    const config = await page.request.get("/api/public/privacy-config");
    expect(await config.json()).toMatchObject({ tracking: "server-only" });

    const missing = await request.put(
      `${ADMIN}/api/admin/users/no-such-id/tracking`,
      { data: { tracking: "enabled" } },
    );
    expect(missing.status()).toBe(404);
  });

  test("the Worker sends nothing for a user who opted out", async ({
    page,
    browser,
    request,
  }) => {
    const optedOut = await createPerson(request, "Opted Out");
    const tracked = await createPerson(request, "Still Tracked");
    await request.put(`${ADMIN}/api/admin/users/${optedOut.id}/tracking`, {
      data: { tracking: "disabled" },
    });

    await signInAs(page, optedOut);
    const second = await browser.newContext();
    await signInAs(await second.newPage(), tracked);
    await waitForWorkerEvent("signed_in", tracked.id);
    await second.close();

    expect(await workerLog()).not.toContain(`distinctId=${optedOut.id}`);
  });
});

// Every event the Worker would have sent is logged with its distinct id.
const workerLog = () =>
  readFile(resolve(import.meta.dirname, "../../.logs/worker.log"), "utf8");
