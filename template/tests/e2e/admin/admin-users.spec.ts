import { test, expect, type APIRequestContext } from "@playwright/test";
import { API, loginAsAdmin, signInToMainApp } from "./helpers";

const USERS = `${API}/api/admin/users`;

interface Page<Item> {
  items: Item[];
  nextCursor: string | null;
  total: { count: number; capped: boolean } | null;
}

interface ListedUser {
  id: string;
  email: string;
}

test.describe("Admin user management", () => {
  test("creates an end-user who can then sign in to the main app", async ({
    request,
  }) => {
    await loginAsAdmin(request);

    const email = `created_${Date.now()}@example.com`;
    const created = await request.post(USERS, {
      data: { email, name: "Created User", password: "created-pass-123" },
    });
    expect(created.status()).toBe(200);
    const createdBody = await created.json();
    expect(createdBody).toMatchObject({ email, emailVerified: true });

    const list = await getJson<Page<ListedUser>>(request, USERS);
    expect(list.items.map((u) => u.email)).toContain(email);

    const signIn = await signInToMainApp(request, email, "created-pass-123");
    expect(signIn.status()).toBe(200);
  });

  test("lists users a page at a time, by offset or after a row", async ({
    request,
  }) => {
    await loginAsAdmin(request);

    const batch = `page_${Date.now()}`;
    for (const letter of ["a", "b", "c"]) {
      const created = await request.post(USERS, {
        data: {
          email: `${batch}_${letter}@example.com`,
          name: `Paged ${letter}`,
          password: "paged-pass-123",
        },
      });
      expect(created.status()).toBe(200);
    }
    const query = `q=${batch}&sort=email&limit=2`;

    const first = await getJson<Page<ListedUser>>(
      request,
      `${USERS}?${query}&withTotal=true`,
    );
    expect(first.items.map((u) => u.email)).toEqual([
      `${batch}_a@example.com`,
      `${batch}_b@example.com`,
    ]);
    expect(first.total).toEqual({ count: 3, capped: false });
    expect(first.nextCursor).toBe(first.items[1].id);

    const byRow = await getJson<Page<ListedUser>>(
      request,
      `${USERS}?${query}&cursor=${first.nextCursor}`,
    );
    const byOffset = await getJson<Page<ListedUser>>(
      request,
      `${USERS}?${query}&cursor=2`,
    );
    expect(byRow.items.map((u) => u.email)).toEqual([`${batch}_c@example.com`]);
    expect(byOffset.items).toEqual(byRow.items);
    expect(byRow.nextCursor).toBeNull();
    expect(byRow.total).toBeNull();

    const deep = await request.get(`${USERS}?cursor=20000`);
    expect(deep.status()).toBe(400);
    const unsorted = await request.get(`${USERS}?sort=emailVerified`);
    expect(unsorted.status()).toBe(400);
  });

  test("sets an end-user password and 404s for a missing user", async ({
    request,
  }) => {
    await loginAsAdmin(request);

    const email = `pw_${Date.now()}@example.com`;
    const created = await request.post(USERS, {
      data: { email, name: "Pw User", password: "first-pass-123" },
    });
    const { id } = await created.json();

    const set = await request.post(`${USERS}/${id}/password`, {
      data: { newPassword: "second-pass-456" },
    });
    expect(set.status()).toBe(200);

    const signIn = await signInToMainApp(request, email, "second-pass-456");
    expect(signIn.status()).toBe(200);

    const missing = await request.post(`${USERS}/no-such-id/password`, {
      data: { newPassword: "whatever-789" },
    });
    expect(missing.status()).toBe(404);
  });
});

async function getJson<T>(request: APIRequestContext, url: string): Promise<T> {
  const res = await request.get(url);
  expect(res.status()).toBe(200);
  return (await res.json()) as T;
}
