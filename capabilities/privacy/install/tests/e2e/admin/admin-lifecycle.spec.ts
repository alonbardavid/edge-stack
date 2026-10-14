import { test, expect, type APIRequestContext } from "@playwright/test";
import { loginAsAdmin, signInToMainApp } from "./helpers";
import { TEST_ADMIN_USERNAME, TEST_ADMIN_PASSWORD } from "./test-admin";

// The admin app's own origin, which proxies /api to whichever Worker serves
// the admin API.
const ADMIN = "http://localhost:5174";
const PASSWORD = "lifecycle-pass-123";
// The users a spec just created are the newest, so they are on the first page.
const NEWEST_FIRST = { sort: "createdAt", dir: "desc", limit: 200 };

test.describe("Admin user lifecycle", () => {
  test("delete locks the account out, restore lets it back in", async ({
    request,
  }) => {
    await loginAsAdmin(request);
    const { id, email } = await createUser(request, "Deletable");
    expect((await signInToMainApp(request, email, PASSWORD)).status()).toBe(
      200,
    );

    expect((await restore(request, id)).status()).toBe(400);
    expect((await nuke(request, id)).status()).toBe(400);

    expect((await remove(request, id)).status()).toBe(200);
    expect((await remove(request, id)).status()).toBe(400);
    const refused = await signInToMainApp(
      request,
      email.toUpperCase(),
      PASSWORD,
    );
    expect(refused.status()).toBe(403);
    expect((await refused.json()).message).toBe(
      "This account has been deleted.",
    );
    expect((await findUser(request, id))?.state).toBe("deleted");

    expect((await restore(request, id)).status()).toBe(200);
    expect((await signInToMainApp(request, email, PASSWORD)).status()).toBe(
      200,
    );
    expect((await findUser(request, id))?.state).toBe("active");
  });

  test("nuke erases the person for good", async ({ request }) => {
    await loginAsAdmin(request);
    const { id, email } = await createUser(request, "Forgettable");

    expect((await remove(request, id)).status()).toBe(200);
    expect((await nuke(request, id)).status()).toBe(200);

    const nuked = await findUser(request, id);
    expect(nuked).toMatchObject({ name: "Deleted user", state: "nuked" });
    expect(nuked?.email).toMatch(/@deleted\.invalid$/);
    expect(JSON.stringify(await listUsers(request))).not.toContain(email);

    expect((await restore(request, id)).status()).toBe(400);
    expect((await nuke(request, id)).status()).toBe(400);
    expect((await signInToMainApp(request, email, PASSWORD)).status()).toBe(
      401,
    );
  });

  test("lifecycle actions 404 for a missing user", async ({ request }) => {
    await loginAsAdmin(request);
    expect((await remove(request, "no-such-id")).status()).toBe(404);
    expect((await restore(request, "no-such-id")).status()).toBe(404);
    expect((await nuke(request, "no-such-id")).status()).toBe(404);
  });

  test("deleting a signed-in user signs them out", async ({
    page,
    request,
  }) => {
    await loginAsAdmin(request);
    const { id, email } = await createUser(request, "Signed In");
    await page.goto("/");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome, Signed In" }),
    ).toBeVisible({ timeout: 10000 });

    expect((await remove(request, id)).status()).toBe(200);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("the admin app deletes, restores and nukes from the users table", async ({
    page,
    request,
  }) => {
    await loginAsAdmin(request);
    const { id, email } = await createUser(request, "Row User");

    await page.goto(`${ADMIN}/admin/`);
    await page.getByLabel("Username").fill(TEST_ADMIN_USERNAME);
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    const search = page.getByRole("textbox", { name: "Search users" });
    await search.fill(email);

    const row = page.getByTestId("admin-user-row").filter({ hasText: email });
    await expect(row).toHaveAttribute("data-state", "active");
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveAttribute("data-state", "deleted");
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(row).toHaveAttribute("data-state", "active");

    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveAttribute("data-state", "deleted");
    await row.getByRole("button", { name: "Nuke" }).click();
    await page
      .getByRole("dialog", { name: "Nuke this user?" })
      .getByRole("button", { name: "Nuke user" })
      .click();
    await expect(row).toHaveCount(0);
    await search.fill(id);
    await expect(page.getByTestId("admin-user-row")).toContainText(
      "Deleted user",
    );
  });
});

async function createUser(
  request: APIRequestContext,
  name: string,
): Promise<{ id: string; email: string }> {
  const email = `lifecycle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const created = await request.post(`${ADMIN}/api/admin/users`, {
    data: { email, name, password: PASSWORD },
  });
  expect(created.status()).toBe(200);
  return { id: (await created.json()).id, email };
}

interface ListedUser {
  id: string;
  name: string;
  email: string;
  state: string;
}

async function listUsers(request: APIRequestContext): Promise<ListedUser[]> {
  const list = await request.get(`${ADMIN}/api/admin/users`, {
    params: NEWEST_FIRST,
  });
  expect(list.status()).toBe(200);
  return (await list.json()).items;
}

async function findUser(
  request: APIRequestContext,
  id: string,
): Promise<ListedUser | undefined> {
  return (await listUsers(request)).find((user) => user.id === id);
}

const remove = (request: APIRequestContext, id: string) =>
  request.post(`${ADMIN}/api/admin/users/${id}/delete`, { data: {} });

const restore = (request: APIRequestContext, id: string) =>
  request.post(`${ADMIN}/api/admin/users/${id}/restore`, { data: {} });

const nuke = (request: APIRequestContext, id: string) =>
  request.post(`${ADMIN}/api/admin/users/${id}/nuke`, { data: {} });
