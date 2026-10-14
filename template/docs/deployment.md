# Deployment

Two long-lived Workers, plus one preview per branch:

| Target         | Worker                                   | D1                                     | Deploys                                         |
| -------------- | ---------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| **production** | `project-name`                           | `project-name-prod`                    | push to `main` (`prod-deploy.yml`)              |
| **staging**    | `project-name-staging`                   | `project-name-staging`                 | push to `main` (`staging-deploy.yml`)           |
| **preview**    | `project-name-staging`, per-branch alias | `project-name-preview-<branch>-<hash>` | push to any other branch (`preview-deploy.yml`) |

`e2e.yml` runs Playwright on every PR and on `main`.

## Generated deploy configs

No deploy uses `wrangler.jsonc` directly. After `pnpm build`, `scripts/gen-wrangler-config.mjs`
stamps a target onto the build-emitted `apps/backend/dist/worker/wrangler.json` and writes it
beside it; every deploy and migrate command passes `--config dist/worker/<outFile>`.

- Static per-target settings (worker name, canonical frontend URL, allowed auth hosts, output
  file) live in `scripts/lib/environments.mjs`, the single domain registry.
- Per-deploy values come from env: `TARGET`, `DB_NAME`, `DB_ID`, and `DEPLOY_ORIGIN` for
  staging and preview, whose workers.dev origins are only known at deploy time.
- The committed config has no `database_id`, but the generated one must:
  `wrangler d1 migrations apply --remote` needs it. Each workflow resolves the id by name.

## Preview

Every push to a non-`main` branch gets its own environment:

1. A stable per-branch D1 name and preview alias are computed from the branch.
2. If that D1 does not exist, it is created and the `project-name-staging` D1 is cloned
   into it. An existing preview D1 is reused, so a re-push keeps its data.
3. Migrations are applied, and `wrangler versions upload --preview-alias` uploads a version
   of the staging Worker that serves only at the alias.
4. The stable preview URL is commented on the PR, with the Worker's size.

`preview-teardown.yml` deletes a branch's D1 when the branch is deleted, and weekly prunes
orphans.

The PR comment's "Worker size" section is parsed by `scripts/worker-size-comment.mjs` from
wrangler's own `Total Upload` line. The limit and growth warning live as env in
`preview-deploy.yml`; the main baseline is the `worker-size-main` artifact that
`staging-deploy.yml` uploads, and is best-effort.

## Staging

`staging-deploy.yml` finds-or-creates the `project-name-staging` D1, migrates it, and
`wrangler deploy`s. Because previews clone this D1, staging keeps preview data and schema
current; preview versions on the same Worker are pinned to their aliases and unaffected.

## Production

`prod-deploy.yml` resolves `project-name-prod` by name and **fails if it is missing** — it
never creates it, so a misconfigured deploy cannot come up against an empty database. Locally,
`pnpm deploy` and `pnpm db:migrate:remote` build, then use `pnpm gen:prod-config`.
