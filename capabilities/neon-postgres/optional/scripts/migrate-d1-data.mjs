#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { describeTarget, resolveDatabaseUrl, withPgClient } from "./lib/pg.mjs";

const USAGE = `Usage: node scripts/migrate-d1-data.mjs (--d1 <name> | --sql <file>) [--database-url <url>] [--replace] [--dry-run]

Copies the rows of a D1 database into Postgres, in one transaction. The Postgres
schema must already exist (pnpm db:migrate against the same target).

  --d1 <name>            export the remote D1 database <name> with wrangler first
  --sql <file>           use an existing \`wrangler d1 export\` file instead
  --database-url <url>   target database (default: $DATABASE_URL, else the local dev DB)
  --replace              empty the target tables first (TRUNCATE ... CASCADE)
  --dry-run              do everything, then roll back`;

const SKIPPED_TABLES = /^(sqlite_|_cf_|d1_migrations$)/;
const MAX_PARAMS = 60000;
const MAX_ROWS_PER_INSERT = 500;
// Millisecond timestamps are above this from 1973 on; second timestamps stay below it
// until the year 5138.
const SECONDS_THRESHOLD = 1e11;

function parseOptions() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        d1: { type: "string" },
        sql: { type: "string" },
        "database-url": { type: "string" },
        replace: { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (err) {
    fail(`${err.message}\n\n${USAGE}`);
  }
  const { values } = parsed;
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (Boolean(values.d1) === Boolean(values.sql)) {
    fail(`Pass exactly one of --d1 or --sql.\n\n${USAGE}`);
  }
  return values;
}

function exportD1(name) {
  const file = join(mkdtempSync(join(tmpdir(), "d1-export-")), `${name}.sql`);
  console.log(`Exporting remote D1 ${name} to ${file}…`);
  execFileSync(
    "pnpm",
    [
      "--filter",
      "@app/backend",
      "exec",
      "wrangler",
      "d1",
      "export",
      name,
      "--remote",
      "--output",
      file,
    ],
    { stdio: "inherit" },
  );
  return file;
}

function loadSqlite(file) {
  const require = createRequire(import.meta.url);
  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    fail("better-sqlite3 is not installed: pnpm add -Dw better-sqlite3");
  }
  const sqlite = new Database(":memory:");
  sqlite.defaultSafeIntegers(true);
  // Load the dump as it is; Postgres enforces the foreign keys when the rows land.
  sqlite.pragma("foreign_keys = OFF");
  sqlite.exec(readFileSync(file, "utf8"));
  return sqlite;
}

function sourceTables(sqlite) {
  return sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name)
    .filter((name) => !SKIPPED_TABLES.test(name));
}

async function targetColumns(client) {
  const { rows } = await client.query(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'`,
  );
  const tables = new Map();
  for (const row of rows) {
    if (!tables.has(row.table_name)) tables.set(row.table_name, new Map());
    tables.get(row.table_name).set(row.column_name, row.data_type);
  }
  return tables;
}

async function foreignKeys(client) {
  const { rows } = await client.query(
    `SELECT child.relname AS child, parent.relname AS parent
       FROM pg_constraint k
       JOIN pg_class child ON child.oid = k.conrelid
       JOIN pg_class parent ON parent.oid = k.confrelid
       JOIN pg_namespace n ON n.oid = k.connamespace
      WHERE k.contype = 'f' AND n.nspname = 'public'`,
  );
  return rows;
}

// Parents before children, so every row's foreign keys already exist when it lands.
function loadOrder(tables, edges) {
  const pending = new Set(tables);
  const parents = new Map(tables.map((table) => [table, new Set()]));
  for (const { child, parent } of edges) {
    if (child !== parent && pending.has(child) && pending.has(parent)) {
      parents.get(child).add(parent);
    }
  }
  const order = [];
  while (pending.size > 0) {
    const ready = [...pending].filter((table) =>
      [...parents.get(table)].every((parent) => !pending.has(parent)),
    );
    if (ready.length === 0) {
      fail(`Circular foreign keys between: ${[...pending].join(", ")}`);
    }
    for (const table of ready.sort()) {
      order.push(table);
      pending.delete(table);
    }
  }
  return order;
}

function convert(value, dataType) {
  if (value === null || value === undefined) return null;
  if (dataType.startsWith("timestamp") || dataType === "date") {
    if (typeof value === "bigint" || typeof value === "number") {
      const n = Number(value);
      return new Date(n < SECONDS_THRESHOLD ? n * 1000 : n);
    }
    return value;
  }
  if (dataType === "boolean") {
    if (typeof value === "bigint" || typeof value === "number") {
      return Number(value) !== 0;
    }
    return value === "true" || value === "1";
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

function quote(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function copyTable(client, sqlite, table, columns) {
  const rows = sqlite.prepare(`SELECT * FROM ${quote(table)}`).all();
  if (rows.length === 0) return 0;
  const names = Object.keys(rows[0]);
  const perInsert = Math.max(
    1,
    Math.min(MAX_ROWS_PER_INSERT, Math.floor(MAX_PARAMS / names.length)),
  );
  const columnList = names.map(quote).join(", ");
  for (let start = 0; start < rows.length; start += perInsert) {
    const chunk = rows.slice(start, start + perInsert);
    const values = [];
    const tuples = chunk.map((row) => {
      const placeholders = names.map((name) => {
        values.push(convert(row[name], columns.get(name)));
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${quote(table)} (${columnList}) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
  return rows.length;
}

// Serial/identity columns would otherwise hand out ids that the copied rows already use.
async function resetSequences(client, tables) {
  const { rows } = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
        AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')`,
    [tables],
  );
  for (const { table_name: table, column_name: column } of rows) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE(MAX(${quote(column)}), 1), MAX(${quote(column)}) IS NOT NULL)
         FROM ${quote(table)}`,
      [quote(table), column],
    );
  }
}

function checkSchema(sqlite, tables, target) {
  const problems = [];
  for (const table of tables) {
    const columns = target.get(table);
    if (!columns) {
      problems.push(`table ${table} does not exist in Postgres`);
      continue;
    }
    for (const { name } of sqlite
      .prepare(`PRAGMA table_info(${quote(table)})`)
      .all()) {
      if (!columns.has(name)) {
        problems.push(`column ${table}.${name} does not exist in Postgres`);
      }
    }
  }
  if (problems.length > 0) {
    fail(
      [
        "The Postgres schema does not match the D1 data — nothing was copied:",
        ...problems.map((problem) => `  - ${problem}`),
        "Apply the migrations to this target first (pnpm db:migrate --database-url …), and port any table the project added before switching to Postgres.",
      ].join("\n"),
    );
  }
}

async function main() {
  const options = parseOptions();
  const url = resolveDatabaseUrl(options["database-url"]);
  const file = options.sql ?? exportD1(options.d1);
  const sqlite = loadSqlite(file);
  if (options.d1) {
    // The export holds every user's data; it is not left behind in a temp dir.
    rmSync(dirname(file), { recursive: true, force: true });
  }
  const tables = sourceTables(sqlite);
  console.log(`Copying ${tables.length} table(s) into ${describeTarget(url)}`);

  await withPgClient(url, async (client) => {
    const target = await targetColumns(client);
    checkSchema(sqlite, tables, target);
    const order = loadOrder(tables, await foreignKeys(client));

    await client.query("BEGIN");
    try {
      if (options.replace) {
        await client.query(`TRUNCATE ${order.map(quote).join(", ")} CASCADE`);
      } else {
        const occupied = [];
        for (const table of order) {
          const { rows } = await client.query(
            `SELECT EXISTS (SELECT 1 FROM ${quote(table)}) AS has_rows`,
          );
          if (rows[0].has_rows) occupied.push(table);
        }
        if (occupied.length > 0) {
          throw new Error(
            `These tables already hold rows: ${occupied.join(", ")}. Pass --replace to empty them first.`,
          );
        }
      }
      for (const table of order) {
        try {
          const copied = await copyTable(
            client,
            sqlite,
            table,
            target.get(table),
          );
          console.log(`  ${table}: ${copied} row(s)`);
        } catch (err) {
          throw new Error(`while copying ${table}: ${err.message}`, {
            cause: err,
          });
        }
      }
      await resetSequences(client, order);
      await client.query(options["dry-run"] ? "ROLLBACK" : "COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });
  console.log(
    options["dry-run"]
      ? "Dry run: everything copied cleanly, and was rolled back."
      : "Done.",
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main().catch((err) => {
  console.error(`Data migration failed, nothing was written: ${err.message}`);
  process.exit(1);
});
