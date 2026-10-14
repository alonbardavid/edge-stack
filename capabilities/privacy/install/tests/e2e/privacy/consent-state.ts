import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { API, APP_ORIGIN, loginAsAdmin } from "../admin/helpers";

// The admin app's own origin, which proxies /api to whichever Worker serves
// the admin API.
export const ADMIN = "http://localhost:5174";

export const DEVICE_TRACKING_KEY = "privacy.tracking";
export const POLICY_VERSION_KEY = "privacy.policy_version";
export const DO_NOT_SELL_LABEL = "Do Not Sell or Share My Personal Information";

const PASSWORD = "privacy-pass-123";

export interface Person {
  id: string;
  name: string;
  email: string;
}

/** A fresh account, so one spec's decision never leaks into another's. */
export async function createPerson(
  request: APIRequestContext,
  name: string,
): Promise<Person> {
  await loginAsAdmin(request);
  const email = `privacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const created = await request.post(`${ADMIN}/api/admin/users`, {
    data: { email, name, password: PASSWORD },
  });
  expect(created.status()).toBe(200);
  return { id: (await created.json()).id, name, email };
}

export async function signInAs(page: Page, person: Person): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: `Welcome, ${person.name}` }),
  ).toBeVisible({ timeout: 10000 });
}

/**
 * What the database holds for the account, read back through the admin API
 * with the admin session `createPerson` opened. Polled: where two local Workers
 * share one database file, it can be busy for a moment, which reads as no
 * answer yet.
 */
export async function storedTracking(
  request: APIRequestContext,
  person: Person,
): Promise<string | null | undefined> {
  // The person a spec just created is the newest, so on the first page.
  const list = await request.get(`${ADMIN}/api/admin/users`, {
    params: { sort: "createdAt", dir: "desc", limit: 200 },
  });
  if (!list.ok()) {
    return undefined;
  }
  const users: { id: string; tracking: string | null }[] = (await list.json())
    .items;
  return users.find((user) => user.id === person.id)?.tracking;
}

/**
 * Nothing geolocates a request locally, so a spec states where it is from with
 * the cookie a developer would set by hand; the Worker honours it outside
 * production only.
 */
export async function statedGeography(
  page: Page,
  value: string,
): Promise<void> {
  await page.context().addCookies([
    { name: "geo_override", value, url: APP_ORIGIN },
    { name: "geo_override", value, url: API },
  ]);
}

export const fromGermany = (page: Page) => statedGeography(page, "DE");
export const fromCalifornia = (page: Page) => statedGeography(page, "US-CA");

/** A banner answered on this device against some earlier policy. */
export async function seedStaleDecision(
  page: Page,
  tracking: string,
): Promise<void> {
  await page.addInitScript(
    ([trackingKey, versionKey, value]) => {
      window.localStorage.setItem(trackingKey, value);
      window.localStorage.setItem(versionKey, "1999-01-01");
    },
    [DEVICE_TRACKING_KEY, POLICY_VERSION_KEY, tracking] as const,
  );
}

export async function readStorage(
  page: Page,
  key: string,
): Promise<string | null> {
  return page.evaluate((name) => window.localStorage.getItem(name), key);
}

/** posthog-js keeps everything it stores under one `ph_<token>_posthog` key. */
export async function posthogStored(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Object.keys(window.localStorage).some(
      (key) => key.startsWith("ph_") && key.endsWith("_posthog"),
    ),
  );
}
