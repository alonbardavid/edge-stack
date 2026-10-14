import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { queryLogger } from "@lib/logging";

const POOL_MAX = 5;

export type Db = NodePgDatabase;

export interface DbEnv {
  DB_CONNECTION_STRING?: string;
}

export interface DbClient {
  db: Db;
  close: () => Promise<void>;
}

// A Neon host is reached over WebSockets with @neondatabase/serverless (which
// supports transactions); anything else — local dev, e2e, CI — uses node-postgres.
export async function createDbClient(env: DbEnv): Promise<DbClient> {
  const connectionString = env.DB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      "No database connection configured: set DB_CONNECTION_STRING",
    );
  }
  return isNeonHost(connectionString)
    ? createNeonClient(connectionString)
    : createNodePostgresClient(connectionString);
}

function isNeonHost(connectionString: string): boolean {
  return new URL(connectionString).hostname.endsWith(".neon.tech");
}

async function createNeonClient(connectionString: string): Promise<DbClient> {
  const [{ Pool }, { drizzle: drizzleNeon }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-serverless"),
  ]);
  const pool = new Pool({ connectionString });
  return {
    db: drizzleNeon({ client: pool, logger: queryLogger() }) as unknown as Db,
    close: () => pool.end(),
  };
}

function createNodePostgresClient(connectionString: string): DbClient {
  const pool = new pg.Pool({ connectionString, max: POOL_MAX });
  return {
    db: drizzle({ client: pool, logger: queryLogger() }),
    close: () => pool.end(),
  };
}
