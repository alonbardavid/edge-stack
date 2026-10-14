# Project Rules

project-name — an edge-stack pnpm + Turbo monorepo on Cloudflare Workers: a Hono API and two
React SPAs served from one Worker, on D1, with Playwright e2e.

## Maintaining this file

This file is loaded into **every** session, so its length is a permanent tax on context.
It is a rulebook, not a changelog.

- **Budget: 100 lines.** To add something once it is full, delete or relocate something.
  Raise the budget only as a deliberate, stated decision — never to accommodate a drift.
- **Prefer a tool to a rule.** If ESLint, the type-checker or a test can enforce a
  convention, enforce it there and leave it out of this file. Put the reasoning in the
  rule's own message or a comment beside it.
- **Leave out traps something else already catches** — anything lint, the compiler or a
  test rejects, anything you would hit and diagnose in the same sitting, and anything
  unlikely to come up again. A trap earns a line only when it is silent, costly, and
  likely to recur.
- **Edit in place; never append.** A new fact overwrites the line it contradicts. State
  only what is true now, in the present tense. History belongs in git.
- **Never belongs here:** how a feature works, change logs, issue/PR numbers, post-mortems,
  or anything one `grep` would answer. Put it in the right doc and link to it: `README.md`
  indexes them — architecture, development and deployment live under `docs/`, a lib's
  reference in its own `README.md`, test traps in `tests/README.md`, code-review rules in
  `.claude/commands/check-conventions.md`.
- Memory goes in this project file, not per-user memory (`~/.claude/…`).

## Working practices

- Given an issue number, read the whole issue before starting: `gh issue view <n>`.
- Use `pnpx`, never `npx`. Drive the running app with `pnpx @playwright/cli@latest <command>`.
- Never add an ADR (`docs/adrs/`) unless asked for one.
- **Every PR with a user-visible change carries screenshots**, uploaded into its
  "Screenshots / video" section — plus a video only when an interaction needs showing.

## Architecture boundaries

- **Admin code is isolated** so it can be extracted into its own app: `@lib/admin-api`,
  `@lib/admin-contract`, or a future `apps/admin-backend` only — plus the admin tables in
  `@lib/db-models`. The host app wires it in with one `app.route("/", adminApp)`.
- **The API is contract-first** (oRPC): declare a procedure in `@lib/contract` before
  implementing it on the `api` implementer, which admits only signed-in users. See
  `docs/architecture.md`.
- Every table has an `id` column, except join tables with a composite key. Its value is
  `newEntityId("<ENTITY>")` from `@lib/db-models`; a new table adds its uppercase prefix to
  `ENTITY_PREFIXES` there first.
- Server code logs a **constant message** with everything variable as a property
  (`log.info("user created", { userId })`); never put emails, passwords or tokens in a
  property.

## Traps

- A Hono middleware must **`return withContext(…, next)`** — LogTape's context is a scope,
  not a store, so fields added outside it are silently dropped.
- `turbo.json`'s backend `build` outputs must include `.wrangler/deploy/**`, or a cache hit
  restores `dist/` without the redirect and deploy-config generation fails.
- `kysely` is pinned in `pnpm.overrides` because better-auth statically imports its kysely
  adapter even on the Drizzle path, and 0.29 dropped the root export it needs.
