#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { resolveDatabaseUrl, describeTarget, withPgClient } from "./lib/pg.mjs";
import { createMigrator, migrateUp } from "./lib/migrator.mjs";

const USAGE = `Usage: pnpm db:migrate [up|down|status] [--database-url <url>]
       pnpm db:new <name>

  up      apply every pending migration (default), in one transaction
  down    revert the last applied migration (needs a matching .down.sql)
  status  list applied and pending migrations

Targets $DATABASE_URL, or the local dev database when unset.`;

const COMMANDS = { up, down, status };

async function up(client) {
  const applied = await migrateUp(client);
  console.log(
    applied.length > 0
      ? `Applied ${applied.length} migration(s): ${applied.join(", ")}`
      : "No pending migrations.",
  );
}

async function down(client) {
  const reverted = await createMigrator(client).down();
  console.log(
    reverted.length > 0
      ? `Reverted ${reverted.map((m) => m.name).join(", ")}`
      : "Nothing to revert.",
  );
}

async function status(client) {
  const migrator = createMigrator(client);
  const executed = await migrator.executed();
  const pending = await migrator.pending();
  console.log(`Applied (${executed.length}):`);
  for (const migration of executed) {
    console.log(`  ✓ ${migration.name}`);
  }
  console.log(`Pending (${pending.length}):`);
  for (const migration of pending) {
    console.log(`  · ${migration.name}`);
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "database-url": { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  const command = COMMANDS[positionals[0] ?? "up"];
  if (!command) {
    console.error(USAGE);
    process.exit(1);
  }
  const url = resolveDatabaseUrl(values["database-url"]);
  console.log(`Migrating ${describeTarget(url)}`);
  await withPgClient(url, command);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
}
