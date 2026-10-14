# Capability: `neon-postgres`

Replaces Cloudflare D1 with Neon serverless Postgres — in the Worker, in local dev and e2e,
and in every deploy target:

- `@lib/db-models` on `drizzle-orm/pg-core`, with a request-scoped client (`withDb`,
  `getDb`, `withTransaction`): the Neon serverless driver on Neon, `node-postgres` elsewhere.
- Hand-written SQL migrations applied by umzug (`pnpm db:migrate`, `pnpm db:new`).
- A local Postgres from npm (`embedded-postgres`, no Docker) for dev, e2e and CI.
- A Neon branch per environment — production on the default branch, `staging`, and a
  copy-on-write `preview/<branch>-<hash>` per git branch — each migrated before its deploy.

GitHub needs one more secret, `NEON_API_KEY`; no connection string is ever stored. It moves
code and schema, not data: `optional/scripts/migrate-d1-data.mjs` copies a D1 database into
Postgres, added to a project only on request, and the move needs a maintenance window.

`INSTALL.md` is the contract `add-edge-capability` executes: `install/` holds new files,
`install-patches/` one git patch per existing file it edits, `optional/` files offered only on
request. The installed `docs/database.md` is the project-side reference.
