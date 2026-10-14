import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "../auth/test-user";
import { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } from "./test-admin";
import { API, loginAsAdmin, signInToMainApp } from "./helpers";

test.describe("Admin/user auth isolation", () => {
  test("an admin session cannot reach protected user API routes", async ({
    request,
  }) => {
    await loginAsAdmin(request);

    const res = await request.get(`${API}/api/me`);
    expect(res.status()).toBe(401);
  });

  test("a user session cannot reach admin API routes", async ({ request }) => {
    const signIn = await signInToMainApp(request, TEST_EMAIL, TEST_PASSWORD);
    expect(signIn.status()).toBe(200);

    const me = await request.get(`${API}/api/admin/auth/me`);
    expect(me.status()).toBe(401);

    const users = await request.get(`${API}/api/admin/users`);
    expect(users.status()).toBe(401);
  });

  test("admin credentials cannot log in through the user login", async ({
    request,
  }) => {
    const res = await signInToMainApp(
      request,
      TEST_ADMIN_USERNAME,
      TEST_ADMIN_PASSWORD,
    );
    expect(res.ok()).toBe(false);
  });

  test("user credentials cannot log in through the admin login", async ({
    request,
  }) => {
    const res = await request.post(`${API}/api/admin/auth/login`, {
      data: { username: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(res.status()).toBe(401);
  });
});
