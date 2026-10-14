#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { LOCAL_DB } from "./lib/local-db-config.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(repoRoot, ".pgdata", "cluster");

// Postgres refuses to run as root, so in a root container (Claude Code on the
// web, Docker) embedded-postgres must run the cluster as the unprivileged
// system `postgres` user, which `createPostgresUser` reuses or creates. Only as
// root: elsewhere it would try to `useradd` and fail.
const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: LOCAL_DB.user,
  password: LOCAL_DB.password,
  port: LOCAL_DB.port,
  persistent: true,
  createPostgresUser: process.getuid?.() === 0,
});

if (!existsSync(join(dataDir, "PG_VERSION"))) {
  await postgres.initialise();
}
await postgres.start();

for (const database of Object.values(LOCAL_DB.databases)) {
  try {
    await postgres.createDatabase(database);
  } catch (err) {
    if (!String(err).includes("already exists")) {
      throw err;
    }
  }
}

const shutdown = async () => {
  await postgres.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
