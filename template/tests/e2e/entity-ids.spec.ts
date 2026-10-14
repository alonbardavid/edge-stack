import { test, expect } from "@playwright/test";
import {
  API,
  APP_ORIGIN,
  loginAsAdmin,
  signInToMainApp,
} from "./admin/helpers";

const NANOID = "[A-Za-z0-9_-]{21}";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

test("ids carry their entity's uppercase prefix", async ({ request }) => {
  await loginAsAdmin(request);
  const me = await request.get(`${API}/api/admin/auth/me`);
  expect((await me.json()).id).toMatch(new RegExp(`^ADM_${NANOID}$`));

  const email = `ids_${Date.now()}@example.com`;
  const created = await request.post(`${API}/api/admin/users`, {
    data: { email, name: "Ids User", password: "ids-pass-123" },
  });
  const { id: userId } = await created.json();
  expect(userId).toMatch(new RegExp(`^U_${NANOID}$`));

  const signIn = await signInToMainApp(request, email, "ids-pass-123");
  expect(signIn.status()).toBe(200);
  const session = await request.get(`${API}/api/auth/get-session`, {
    headers: { origin: APP_ORIGIN },
  });
  const body = await session.json();
  expect(body.user.id).toBe(userId);
  expect(body.session.id).toMatch(new RegExp(`^US_${UUID}$`));
});
