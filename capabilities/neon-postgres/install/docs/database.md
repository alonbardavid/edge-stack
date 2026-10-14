# Database

Postgres everywhere: a Neon branch per deployed environment, and a local Postgres from npm
for dev and e2e. Drizzle (`drizzle-orm/pg-core`) holds the schema in
`libs/db-models/src/schemas/`.

## Connecting

The worker's only database input is the `DB_CONNECTION_STRING` var. A `*.neon.tech` host is
reached through `@neondatabase/serverless` (a WebSocket pool, so transactions work); any
other host — local dev, e2e, CI — through `node-postgres`. `libs/db-models/src/client.ts`
picks the driver.

Workers cannot reuse a connection across requests, so `withDb(env, run, waitUntil)` opens a
pool per request, runs `run` in an `AsyncLocalStorage` scope, and closes the pool through
`waitUntil`. `dbMiddleware` (`@lib/server-commons`) wraps every `/api/*` request in it. A
non-fetch entrypoint (cron, queue) must open its own `withDb`, or `getDb()` throws.

- **`getDb()`** returns the current request's client. Call it where you use it: a stored or
  returned handle keeps pointing at the client it resolved on, and would run outside a later
  transaction (ESLint rejects both).
- **`withTransaction(fn)`** scopes every `getDb()` inside `fn` to one transaction — no `tx`
  to pass around.
- **`stableDbRef`** is a proxy that resolves the current client on every access. It exists
  only for libraries that keep the db they are given — better-auth's `drizzleAdapter` in
  `libs/identity/src/auth.ts`. Application code uses `getDb()`.

`user` is a reserved word in Postgres: Drizzle quotes it, hand-written SQL must write
`"user"`. `count()` / `sum()` come back as strings from `pg`; cast in SQL
(`cast(... as int)`).

## Migrations

Migrations are hand-written SQL in `migrations/` — `0_init.sql` is the baseline, every later
file is `<YYYYMMDDHHMMSS>_<name>.sql` — applied in file-name order by umzug and logged in a
`schema_migrations` table. Every pending file runs in one transaction, so a failing migration
applies nothing. A `<name>.down.sql` beside a migration enables `down`. Nothing generates SQL
from the Drizzle schema: a change to `libs/db-models/src/schemas/` needs its matching
migration.

```bash
pnpm db:new <name>                                 # creates migrations/<timestamp>_<name>.sql
pnpm db:migrate [up|down|status] [--database-url <url>]   # $DATABASE_URL, else local dev
```

A preview's Neon branch is reused across pushes and keeps its `schema_migrations` rows, so a
migration that has run anywhere is never edited or renumbered — write a new one.

## Local Postgres

`embedded-postgres` runs Postgres 17 from npm on port **5433**, data in `.pgdata/`, with two
databases: `project_name_dev` and `project_name_test`. `scripts/lib/local-db-config.mjs` holds
the port, credentials and URLs.

```bash
pnpm db:start     # start it and migrate the dev database (pnpm dev runs this first)
pnpm db:stop
```

It runs detached, logging to `.pgdata/local-db.log`. As root (containers, Claude Code on the
web) the cluster runs as the system `postgres` user, since Postgres refuses to run as root;
every parent directory of the repo must then be traversable by that user.

## Neon

One Neon project, named `project-name`. Its default branch is production, `staging` is a
branch of it, and each git branch gets `preview/<branch>-<hash>`, a copy-on-write branch of
staging. Every deploy migrates its branch before shipping the worker.

`.github/actions/neon-env` derives the project from the `NEON_API_KEY` secret (the project
named `project-name`, or the only one the key can see; an optional `NEON_PROJECT_ID` secret
overrides it), finds or creates the branch, and resolves its connection string for
`neondb` / `neondb_owner`. It masks the string and its password before output: every branch
inherits production's role password. No connection string is stored in GitHub.

`DB_CONNECTION_STRING` is a plain worker var in each generated config, visible to anyone
with dashboard access to the Worker.

Admins on a deployed environment: `pnpm admin:create --username <u> --password <p>
--database-url <url>`, with the branch's connection string from the Neon console.
