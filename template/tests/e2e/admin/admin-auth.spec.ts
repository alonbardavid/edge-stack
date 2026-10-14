import { test, expect } from "@playwright/test";
import { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } from "./test-admin";
import { API, loginAsAdmin } from "./helpers";

test.describe("Admin auth (API)", () => {
  test("rejects unauthenticated access to protected routes", async ({
    request,
  }) => {
    const res = await request.get(`${API}/api/admin/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("rejects missing credentials with 400", async ({ request }) => {
    const res = await request.post(`${API}/api/admin/auth/login`, {
      data: { username: "" },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects invalid credentials with 401", async ({ request }) => {
    const res = await request.post(`${API}/api/admin/auth/login`, {
      data: { username: TEST_ADMIN_USERNAME, password: "wrong-password" },
    });
    expect(res.status()).toBe(401);
  });

  test("logs in, exposes the session via /me, and logs out", async ({
    request,
  }) => {
    await loginAsAdmin(request);

    const me = await request.get(`${API}/api/admin/auth/me`);
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({ username: TEST_ADMIN_USERNAME });

    const logout = await request.post(`${API}/api/admin/auth/logout`);
    expect(logout.status()).toBe(200);

    const after = await request.get(`${API}/api/admin/auth/me`);
    expect(after.status()).toBe(401);
  });

  test("logout itself requires authentication", async ({ request }) => {
    const res = await request.post(`${API}/api/admin/auth/logout`);
    expect(res.status()).toBe(401);
  });

  test("returns 404 for unknown admin routes when authenticated", async ({
    request,
  }) => {
    await loginAsAdmin(request);
    const res = await request.get(`${API}/api/admin/does-not-exist`);
    expect(res.status()).toBe(404);
  });
});

test.describe("Admin auth (UI)", () => {
  test("opens /admin without a trailing slash and shows the login screen", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Admin sign in" }),
    ).toBeVisible();
  });

  test("logs in and reaches user management without a self-password screen", async ({
    page,
  }) => {
    await page.goto("/admin/");
    await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { name: "Create user" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: "My account" })).toHaveCount(0);
  });
});
