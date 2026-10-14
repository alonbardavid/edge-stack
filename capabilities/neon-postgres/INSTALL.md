# Install: `neon-postgres`

> This file is the **install contract** that `add-edge-capability` executes, top to bottom.
> `install/` holds the **new** files; `install-patches/` holds one **git patch per existing
> project file** the capability modifies. Nothing here asks you to hand-edit a file from a
> prose description — apply the patch, and fall back to merging by intent only when a patch
> conflicts.

Moves the project's database from Cloudflare D1 to Neon serverless Postgres, in the Worker,
local dev, e2e and every deploy target. `README.md` summarises it; the installed
`docs/database.md` is the project-side reference.

## Before you install

**This moves code and schema, not data.** The install leaves the existing D1 databases
untouched and copies nothing to Neon. Ask the user whether any of them (usually
`<slug>-prod`, sometimes `<slug>-staging`; previews are disposable) holds data they want to
keep. If so, tell them a one-off copy script exists and follow **Moving existing D1 data**
below once they ask for it — do not add the script to the project otherwise. Also tell them
that moving the data **needs downtime**: the app goes into maintenance, at the Cloudflare
domain level, for as long as the copy and the deploy take. Moving without downtime is not
supported by this capability (see *No live migration* below).

## Steps

### 1. Copy the new files and apply the patches

From the project root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/capabilities/neon-postgres"
```

It copies `install/` (rendering `project-name` / `project_name` / `REPLACE_WITH_TODAY` in
contents and file names), renders the same placeholders in each patch, and applies it. A
patch that no longer applies is retried as a real 3-way merge against the base template
file, and the script reports each file as applied, 3-way merged, conflicted, or failed
(exit code 2 if anything needs you). New files:

```
.github/actions/neon-env/action.yml               # project / branch / connection-string resolver
docs/adrs/REPLACE_WITH_TODAY_{postgres,neon}.md   # the decision records
docs/database.md                                  # the project's database reference
libs/db-models/src/client.ts                      # driver selection by host
libs/server-commons/src/db-middleware.ts          # withDb around every /api request
scripts/local-db.mjs, scripts/local-db-server.mjs # local Postgres start/stop/ensure
scripts/migrate.mjs                               # migration CLI
scripts/lib/{local-db-config,migrator,pg}.mjs
```

| Patch | What it does |
| --- | --- |
| `libs/db-models/package.json`, `tsconfig.json` | `pg`, `@neondatabase/serverless`, `@types/pg`, `@types/node`; node types for `AsyncLocalStorage` |
| `libs/db-models/src/db.ts` | `withDb`, `getDb`, `withTransaction`, `stableDbRef`, `checkHealth` on Postgres, logging through `@lib/logging` |
| `libs/db-models/src/env.d.ts`, `index.ts` | `DB_CONNECTION_STRING` replaces the `DB` D1 binding; new exports |
| `libs/db-models/src/listing.ts` | `paginate()` over `pg-core` types; the search is `ilike` |
| `libs/db-models/src/schemas/auth.ts`, `admin.ts` | `sqliteTable` → `pgTable`, `timestamptz` + `defaultNow()`, native booleans |
| `migrations/0_init.sql` | the baseline schema as Postgres DDL (`"user"` quoted) |
| `libs/server-commons/package.json`, `tsconfig.json`, `src/index.ts` | depends on `@lib/db-models`; exports `dbMiddleware` |
| `apps/backend/src/index.ts` | `app.use("/api/*", dbMiddleware)` right after the request logger, before every route |
| `apps/backend/src/env.d.ts` | drops the `DB: D1Database` binding |
| `apps/backend/wrangler.jsonc` | removes `d1_databases`; adds the local-dev `DB_CONNECTION_STRING` var |
| `apps/backend/vite.config.ts` | `WORKER_DATABASE_URL` overrides that var (e2e); the `WORKER_PERSIST_TO` D1 isolation is gone |
| `libs/identity/src/auth.ts` | better-auth's drizzle adapter gets `stableDbRef` with `provider: "pg"` |
| `libs/admin-api/src/users/service.ts` | `createUser` inserts user + account in one `withTransaction` |
| `eslint.config.mjs` | forbids storing or returning `getDb()` |
| `package.json` | `db:start` / `db:stop` / `db:migrate`; `predev` starts Postgres; `gen:prod-config` takes `DB_CONNECTION_STRING`; drops `db:migrate:remote`; `pg`, `umzug`, `embedded-postgres` |
| `scripts/gen-wrangler-config.mjs` | stamps `DB_CONNECTION_STRING` instead of a `d1_databases` block |
| `scripts/create-admin.mjs`, `scripts/lib/build-admin-sql.mjs` | parameterized insert over `pg`; `--database-url` replaces `--db-name` |
| `tests/package.json`, `global-setup.ts`, `seed-utils.ts`, `playwright.config.ts` | migrate/truncate/seed the test database with `pg`; the backend web server ensures Postgres is up and targets the test database |
| `.github/workflows/e2e.yml` | starts the local Postgres (`pnpm db:start`) before the tests, its log on failure |
| `.github/workflows/preview-deploy.yml` | find-or-create `preview/<branch>-<hash>` off `staging`, migrate, deploy |
| `.github/workflows/staging-deploy.yml` | find-or-create `staging`, migrate, deploy |
| `.github/workflows/prod-deploy.yml` | resolve the default branch (never create), migrate, deploy |
| `.github/workflows/preview-teardown.yml` | delete the branch's Neon branch; prune orphaned `preview/*` weekly |
| `.gitignore` | `.pgdata` (local cluster) instead of `.wrangler-test` |
| `.claude/hooks/setup-remote.sh`, `.claude/settings.json` | web sessions start Postgres on session start; drops the `wrangler d1` / `sqlite3` permissions |
| `CLAUDE.md` | the intro line, `docs/` in the docs index, the Postgres-never-D1 rule (code a later capability brings for D1 is ported), and three database traps (hand-written migrations, never edit a run migration, `count()` as strings) |
| `docs/adrs/REPLACE_WITH_TODAY_drizzle.md` | the Drizzle ADR's migrations decision: umzug instead of wrangler. The script patches the project's own dated copy (`docs/adrs/<date>_drizzle.md`); a project scaffolded before that ADR existed has none, and the script reports the patch as failed — the one patch that may be skipped |
| `README.md` | the description, `pnpm dev`, and `docs/database.md` in the docs index |
| `docs/architecture.md` | the layout's `db-models` / `migrations` lines, better-auth over Postgres, `admin:create --database-url` |
| `docs/development.md` | local Postgres instead of the local D1 |
| `docs/deployment.md` | Neon branches per target, migrate-before-deploy, the generator's `DB_CONNECTION_STRING` |
| `tests/README.md` | e2e's own `project_name_test` database, started before the web servers |

### 2. Resolve conflicts

Resolve every conflict marker **by intent**: keep the Postgres side of anything about the
database, and keep whatever the other side added for its own feature. Never bring back a D1
artifact — `d1_databases`, `DB_NAME`/`DB_ID`, `wrangler d1 …`, `db:migrate:remote`,
`getDb()` handed to better-auth. After resolving, `git grep -n -i -E "d1_databases|DB_NAME|DB_ID|wrangler d1|D1Database"`
must find nothing. Tell the user which files needed merging and why.

On a project that has edited its own docs, the doc patches (`CLAUDE.md`, `README.md`,
`docs/*`, `tests/README.md`) are the likeliest to need the intent fallback. Their hunks are
independent, so apply what lands and merge the rest.

### 3. Port the project's own tables (only if it has any)

The patches cover the base schema (`auth.ts`, `admin.ts`, `0_init.sql`). If the project
has added its own schema files, migrations or queries since it was scaffolded, ask the user,
then convert them:

- `sqliteTable` → `pgTable`; `integer(…, { mode: "timestamp_ms" })` →
  `timestamp(…, { withTimezone: true, mode: "date" })`; `integer(…, { mode: "boolean" })` →
  `boolean(…)`; `unixepoch(…)` defaults → `.defaultNow()` / `DEFAULT now()`.
- Each extra D1 migration becomes a Postgres migration (`pnpm db:new <name>`), in the same
  order.
- Query API: `.run(sql)` → `.execute(sql)`; `.get()` / `.all()` → `await` the query (take
  `[0]` for one row); `db.batch([...])` → `withTransaction(async () => { … })`. Raw SQL must
  quote `"user"`, and `count()` / `sum()` come back as strings from `pg` — cast in SQL.
- Never keep `getDb()` in a variable (the new lint rule enforces it). A cron/queue handler
  must wrap its work in `withDb(env, …, ctx.waitUntil)`.

### 4. Record the version

Add `"neon-postgres": "<version from capability.json>"` to `capabilities` in
`.edge-stack.json`.

### 5. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

`pnpm test` starts the local Postgres itself if nothing serves port 5433 (first run
downloads nothing extra — the binaries come with `pnpm install`). Then show the user
`pnpm dev`, which starts Postgres and migrates the dev database before building.

If something goes wrong here:

- **Postgres does not start** — read `.pgdata/local-db.log`. As root (containers, Claude Code
  on the web) the cluster runs as the system `postgres` user, so every parent directory of
  the repo must be traversable by that user.
- **`vite dev` fails with esbuild's "Host version … does not match binary version …"** — the
  first, lockfile-resolving install left a stale platform-binary link. Delete every
  `node_modules` and run `pnpm install` again.

## Setup (manual, tell the user)

Local dev and e2e need nothing. To deploy:

1. **Create one Neon project** named after the project slug (`project-name`), in a region
   close to the users. Its default branch is production; the workflows create `staging`
   (first push to `main`) and every `preview/…` branch themselves.
2. **Create a Neon API key** that can see that project — an organization API key, or a
   project-scoped one — and add it as the `NEON_API_KEY` repo secret. That is the only new
   GitHub setting; there are still no repo variables. Set the optional `NEON_PROJECT_ID`
   secret only if the key sees several projects and none is named after the slug.
3. Push `main` once before the first preview: previews branch off `staging`, which
   staging-deploy creates.
4. The D1 databases (`<slug>-prod`, `<slug>-staging`, `<slug>-preview-*`) are no longer used.
   Once any data the user wants is moved (see below), they can delete them (`wrangler d1 delete <name>`);
   the Cloudflare token no longer needs D1 permissions.
5. Admins on a deployed environment: `pnpm admin:create --username <u> --password <p>
   --database-url <url>` with the branch's connection string from the Neon console.

## Moving existing D1 data (only when the user asks)

`optional/scripts/migrate-d1-data.mjs` copies a D1 database's rows into Postgres. It is not
part of `install/` and `apply-capability.mjs` never copies it: add it to the project only
when the user wants their data moved. Copy it to the project's `scripts/` as is (no
placeholders); it uses `scripts/lib/pg.mjs` from this capability and the root
`better-sqlite3` dev dependency the template already has.

```bash
node scripts/migrate-d1-data.mjs --d1 <d1-name> [--database-url <url>] [--replace] [--dry-run]
node scripts/migrate-d1-data.mjs --sql <export.sql> ...   # an existing `wrangler d1 export` file
```

It exports the remote D1 with wrangler (the user's Cloudflare login or
`CLOUDFLARE_API_TOKEN`, with D1 read access), loads the dump into an in-memory SQLite, and
inserts every table into Postgres in foreign-key order, **in one transaction**: any error
writes nothing. It converts by the Postgres column type — integer timestamps (milliseconds,
or seconds) to `timestamptz`, `0`/`1` to booleans — and resets serial/identity sequences.
It refuses when a D1 table or column has no Postgres counterpart (port the project's own
tables first, step 3), and when a target table already holds rows unless `--replace` is
passed (`TRUNCATE … CASCADE`). The downloaded export is deleted once loaded. Without
`--database-url` it targets `$DATABASE_URL`, else the local dev database.

The order, per environment that has data worth keeping (production first):

1. Create the schema on the target branch: `pnpm db:migrate --database-url <url>`, with the
   branch's connection string from the Neon console (production = the default branch).
2. Rehearse into the local dev database: `node scripts/migrate-d1-data.mjs --d1 <slug>-prod`,
   then `pnpm dev` and check the data and sign-ins. `--dry-run` against the real target
   proves it will load without writing anything.
3. Switch production during a maintenance window (below) — rows written to D1 after the
   export would be lost, so nothing may write while it runs:
   1. Turn maintenance on.
   2. Run the real copy:
      `node scripts/migrate-d1-data.mjs --d1 <slug>-prod --database-url <url>`.
   3. Merge, and wait for prod-deploy to ship the Postgres worker (its migration step finds
      nothing pending).
   4. Check the app from an allowlisted address, then turn maintenance off.
4. For staging, do the same from `<slug>-staging` into the `staging` branch before any
   preview branches off it. Preview D1s are not worth moving.
5. Keep the D1 databases until the user has checked the new environment; then delete them
   (Setup, step 4). The script is a one-off — it can be removed from the project afterwards.

### Maintenance window

The app is taken offline at the **Cloudflare domain level**, in front of the Worker, so
neither the old D1 worker nor the new Postgres one can take a write mid-copy, and the deploy
in between can never serve a half-migrated database. Add a WAF custom rule on the
production zone: match the app's hostnames — excluding the user's own IP, so they can check
the result — with the action **Block**. On the Pro plan and above, give it a custom HTML
response (a short "down for maintenance" page; the status code must be 400–499); on the
Free plan visitors see Cloudflare's default block page. Delete or disable the rule to end
the window.

A zone rule only covers the zone's hostnames. If the production Worker's own `workers.dev`
URL is enabled, it bypasses the rule — disable it for the window (Worker → Settings →
Domains & Routes). Staging is served from `workers.dev`, so it cannot be blocked this way;
it rarely needs to be, since a lost staging write does not matter.

### No live migration

Moving from D1 to Postgres **without downtime is not supported**: this capability swaps D1
out in a single change. If the user needs it, the app has to run D1 and Neon side by side,
behind a flag with these stages, which they build by hand rather than by installing this
capability as is:

1. Read and write D1 only (ship both database layers; Neon is idle).
2. Read from D1, write to both — and backfill the rows that predate the dual writes into
   Neon.
3. Read from Neon, write to both — D1 stays current, so switching back is still possible.
4. Once everything is on Neon, remove the D1 code and the flag.
