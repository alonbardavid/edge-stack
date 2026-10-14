import pg from "pg";
import { DEV_DATABASE_URL } from "./local-db-config.mjs";

// An explicit --database-url wins, then $DATABASE_URL, then the local dev DB.
export function resolveDatabaseUrl(explicit) {
  return explicit ?? process.env.DATABASE_URL ?? DEV_DATABASE_URL;
}

export function describeTarget(url) {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`;
}

export async function withPgClient(url, run) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}
