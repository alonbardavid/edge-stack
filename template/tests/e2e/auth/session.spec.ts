import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD, TEST_NAME } from "./test-user";
import { API, signInToMainApp } from "../admin/helpers";

test.describe("API session", () => {
  test("a signed-in user is served their own record", async ({ request }) => {
    const signIn = await signInToMainApp(request, TEST_EMAIL, TEST_PASSWORD);
    expect(signIn.status()).toBe(200);

    const me = await request.get(`${API}/api/me`);
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({
      email: TEST_EMAIL,
      name: TEST_NAME,
    });
  });

  test("a signed-out request is rejected", async ({ request }) => {
    const me = await request.get(`${API}/api/me`);
    expect(me.status()).toBe(401);
    expect(await me.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
