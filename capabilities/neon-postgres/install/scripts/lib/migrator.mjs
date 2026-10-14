import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Umzug } from "umzug";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../migrations",
);
const MIGRATIONS_TABLE = "schema_migrations";

export function createMigrator(client) {
  return new Umzug({
    migrations: {
      glob: ["*.sql", { cwd: MIGRATIONS_DIR, ignore: "*.down.sql" }],
      resolve: ({ name, path }) => ({
        name,
        up: ({ context }) => runSqlFile(context, path),
        down: ({ context }) => runDownFile(context, path, name),
      }),
    },
    context: client,
    storage: new PostgresStorage(client),
    logger: console,
  });
}

export async function migrateUp(client) {
  const migrator = createMigrator(client);
  await client.query("BEGIN");
  try {
    const applied = await migrator.up();
    await client.query("COMMIT");
    return applied.map((migration) => migration.name);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

function runSqlFile(client, path) {
  return client.query(readFileSync(path, "utf8"));
}

function runDownFile(client, path, name) {
  const downPath = path.replace(/\.sql$/, ".down.sql");
  if (!existsSync(downPath)) {
    throw new Error(`No down migration for ${name} (expected ${downPath})`);
  }
  return runSqlFile(client, downPath);
}

class PostgresStorage {
  constructor(client) {
    this.client = client;
  }

  async executed() {
    await this.ensureTable();
    const result = await this.client.query(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name`,
    );
    return result.rows.map((row) => row.name);
  }

  async logMigration({ name }) {
    await this.ensureTable();
    await this.client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name],
    );
  }

  async unlogMigration({ name }) {
    await this.ensureTable();
    await this.client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = $1`, [
      name,
    ]);
  }

  async ensureTable() {
    await this.client.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
  }
}
