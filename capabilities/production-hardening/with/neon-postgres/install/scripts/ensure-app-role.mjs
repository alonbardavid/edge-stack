#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { describeTarget, withPgClient } from "./lib/pg.mjs";

// The deployed Workers connect as this role, never as the branch owner that
// runs migrations: it reads and writes rows but cannot change the schema.
// Neon makes every role it creates a member of neon_superuser, so this one is
// created in SQL, and Neon never learns its password — APP_ROLE_PASSWORD is
// the only copy. Idempotent: every deploy runs it after migrating.
const ROLE = "project_name_app";
const MIGRATIONS_TABLE = "schema_migrations";

async function main() {
  const ownerUrl = requireEnv("DATABASE_URL");
  const password = requireEnv("APP_ROLE_PASSWORD");
  if (password.length < 16) {
    fail("APP_ROLE_PASSWORD must be at least 16 characters");
  }
  console.log(`Ensuring role ${ROLE} on ${describeTarget(ownerUrl)}`);
  await withPgClient(ownerUrl, async (client) => {
    const role = client.escapeIdentifier(ROLE);
    const database = client.escapeIdentifier(
      decodeURIComponent(new URL(ownerUrl).pathname.slice(1)),
    );
    const existing = await client.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [ROLE],
    );
    if (existing.rowCount === 0) {
      await client.query(`CREATE ROLE ${role} LOGIN`);
    }
    await client.query(
      `ALTER ROLE ${role} WITH LOGIN PASSWORD ${client.escapeLiteral(password)}`,
    );
    for (const statement of [
      `GRANT CONNECT ON DATABASE ${database} TO ${role}`,
      `GRANT USAGE ON SCHEMA public TO ${role}`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
      // Default privileges are recorded per granting role: this must run as
      // the role that runs migrations, so tables they create are covered.
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
    ]) {
      await client.query(statement);
    }
    const migrations = await client.query("SELECT to_regclass($1) AS name", [
      `public.${MIGRATIONS_TABLE}`,
    ]);
    if (migrations.rows[0].name) {
      await client.query(
        `REVOKE ALL ON TABLE ${client.escapeIdentifier(MIGRATIONS_TABLE)} FROM ${role}`,
      );
    }
  });

  const appUrl = new URL(ownerUrl);
  appUrl.username = ROLE;
  appUrl.password = password;
  console.log(`Role ${ROLE} is ready`);
  if (process.env.GITHUB_OUTPUT) {
    console.log(`::add-mask::${appUrl.href}`);
    appendFileSync(process.env.GITHUB_OUTPUT, `db_url=${appUrl.href}\n`);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`Missing required env var ${name}`);
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((err) => {
  console.error("Ensuring the app role failed:", err.message);
  process.exit(1);
});
