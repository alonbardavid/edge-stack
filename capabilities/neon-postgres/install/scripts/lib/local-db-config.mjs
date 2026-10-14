// The local Postgres cluster started by `pnpm db:start` (scripts/local-db.mjs).
// CI's e2e job starts the same cluster.
export const LOCAL_DB = {
  host: "localhost",
  port: 5433,
  user: "postgres",
  password: "postgres",
  databases: { dev: "project_name_dev", test: "project_name_test" },
};

export function localConnectionString(database) {
  const { user, password, host, port } = LOCAL_DB;
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

export const DEV_DATABASE_URL = localConnectionString(LOCAL_DB.databases.dev);
export const TEST_DATABASE_URL = localConnectionString(LOCAL_DB.databases.test);
