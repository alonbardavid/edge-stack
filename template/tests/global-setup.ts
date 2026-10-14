import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { buildCreateUserSql, buildCreateAdminSql } from "./seed-utils";
import { TEST_EMAIL, TEST_PASSWORD, TEST_NAME } from "./e2e/auth/test-user";
import {
  TEST_ADMIN_USERNAME,
  TEST_ADMIN_PASSWORD,
} from "./e2e/admin/test-admin";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, "../apps/backend");

const PERSIST = "./.wrangler-test";

function runWrangler(args: string[]) {
  execFileSync(
    "pnpm",
    ["exec", "wrangler", ...args, "--local", "--persist-to", PERSIST],
    { cwd: backendDir, stdio: "inherit" },
  );
}

export default async function globalSetup() {
  console.log("[global-setup] applying migrations to test DB");
  runWrangler(["d1", "migrations", "apply", "DB"]);

  console.log("[global-setup] resetting test DB tables");
  runWrangler([
    "d1",
    "execute",
    "DB",
    "--command",
    "DELETE FROM user_sessions; DELETE FROM user_accounts; DELETE FROM user_verifications; DELETE FROM user; DELETE FROM app_admin_session; DELETE FROM app_admin;",
  ]);

  console.log("[global-setup] seeding verified test user");
  const userSql = await buildCreateUserSql({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: TEST_NAME,
  });
  runWrangler(["d1", "execute", "DB", "--command", userSql]);

  console.log("[global-setup] seeding test admin");
  const adminSql = await buildCreateAdminSql({
    username: TEST_ADMIN_USERNAME,
    password: TEST_ADMIN_PASSWORD,
  });
  runWrangler(["d1", "execute", "DB", "--command", adminSql]);
}
