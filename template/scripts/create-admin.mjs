#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { parseArgs } from "node:util";
import { buildCreateAdminSql } from "./lib/build-admin-sql.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, "../apps/backend");

const USAGE = `Usage: pnpm admin:create --username <username> --password <password> [--db-name <name>]

Creates an admin user (app_admin table) directly in D1.
  (default)         apply to the local dev DB
  --db-name <name>  apply to a named remote D1 database (e.g. project-name-prod, project-name-staging)`;

function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        username: { type: "string" },
        password: { type: "string" },
        "db-name": { type: "string" },
        help: { type: "boolean", default: false },
      },
    });
  } catch (err) {
    console.error(err.message);
    console.error(USAGE);
    process.exit(1);
  }

  const { username, password, help } = parsed.values;
  const dbName = parsed.values["db-name"];
  if (help || !username || !password) {
    console.log(USAGE);
    process.exit(help ? 0 : 1);
  }

  const database = dbName ?? "DB";
  const describeTarget = dbName ? `remote "${dbName}"` : "local";

  buildCreateAdminSql({ username, password })
    .then((sql) => {
      const wranglerArgs = [
        "exec",
        "wrangler",
        "d1",
        "execute",
        database,
        "--command",
        sql,
      ];
      if (dbName) {
        wranglerArgs.push("--remote");
      } else {
        wranglerArgs.push("--local");
      }

      console.log(
        `Creating admin ${username} in the ${describeTarget} database…`,
      );
      execFileSync("pnpm", wranglerArgs, { cwd: backendDir, stdio: "inherit" });
      console.log("Done. The admin can sign in at /admin.");
    })
    .catch((err) => {
      console.error("Failed to create admin:", err.message);
      process.exit(1);
    });
}

main();
