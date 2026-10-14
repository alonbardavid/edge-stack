import { expect, APIRequestContext } from "@playwright/test";
import { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } from "./test-admin";

export const API = "http://localhost:8301";
export const APP_ORIGIN = "http://localhost:5173";

export async function loginAsAdmin(request: APIRequestContext) {
  const res = await request.post(`${API}/api/admin/auth/login`, {
    data: { username: TEST_ADMIN_USERNAME, password: TEST_ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
}

export function signInToMainApp(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  return request.post(`${API}/api/auth/sign-in/email`, {
    headers: { origin: APP_ORIGIN },
    data: { email, password },
  });
}
