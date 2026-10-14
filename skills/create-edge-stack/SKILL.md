---
name: create-edge-stack
description: Scaffold a new opinionated "edge stack" project (pnpm + Turbo monorepo, Cloudflare Workers + D1, Hono backend, React/Vite frontend, Playwright e2e, GitHub Actions preview/prod deploys) from the bundled template, then guide GitHub + Cloudflare setup. Invoke explicitly when the user asks to create/scaffold a new edge-stack project.
---

# create-edge-stack

Scaffold a new edge-stack project from the bundled template, install it, run its tests, and
then walk the user through GitHub and Cloudflare setup.

**Plugin root:** the bundled assets live under `${CLAUDE_PLUGIN_ROOT}` (the `edge-stack`
plugin dir). If that variable is unset (running from the source repo), use this skill file's
grandparent directory (the repo root). Key paths:

- Template: `${CLAUDE_PLUGIN_ROOT}/template`
- Capabilities/version registry: `${CLAUDE_PLUGIN_ROOT}/capabilities`

## 1. Gather inputs

Ask for / confirm:

- **Project name** — a kebab-case slug (lowercase, digits, dashes), e.g. `acme-app`. This
  becomes the package name, Worker names, and D1 names. Derive the snake_case form
  (`acme_app`) for token keys.
- **Target directory** — default `../<project-name>` relative to cwd, or an explicit path.
  Refuse to scaffold into a non-empty directory.
- **One-line description** (optional) — for `package.json` `description` and the README.
- Whether to **init git** and whether to set up **GitHub** and **Cloudflare** now (you can do
  the local scaffold first and the remote setup after).
- Whether they will work on the project from **Claude Code on the web** (cloud sessions). It
  decides how PR screenshots get hosted (§6).

## 2. Copy the template

Copy the entire contents of `${CLAUDE_PLUGIN_ROOT}/template` (including dotfiles like
`.github`, `.husky`, `.claude`, `.gitignore`, `.edge-stack.json`) into the target dir. Do
**not** copy any `node_modules`, `dist`, `.turbo`, `.wrangler` (the template has none).

```bash
mkdir -p "$TARGET"
cp -R "${CLAUDE_PLUGIN_ROOT}/template/." "$TARGET/"
```

## 3. Replace placeholders

The template uses three placeholder tokens. Replace them everywhere (text files only):

- `project-name` → the kebab slug (e.g. `acme-app`)
- `project_name` → the snake slug (e.g. `acme_app`)
- `REPLACE_WITH_TODAY` → today's date, `YYYY-MM-DD` — in ADR contents **and file names**
  (`docs/adrs/REPLACE_WITH_TODAY_<topic>.md`)

```bash
cd "$TARGET"
TODAY=$(date +%F)
grep -rIl -e "project-name" -e "project_name" -e "REPLACE_WITH_TODAY" . \
  | xargs sed -i '' -e "s/project-name/$SLUG/g" -e "s/project_name/$SNAKE/g" \
      -e "s/REPLACE_WITH_TODAY/$TODAY/g"
find . -name "*REPLACE_WITH_TODAY*" | while read -r f; do mv "$f" "${f//REPLACE_WITH_TODAY/$TODAY}"; done
```

(On Linux/CI use `sed -i` without the `''`.) Then set `package.json` `description` if one was
given, and confirm `.edge-stack.json` `name` is the slug. Leave `REPLACE_WITH_PROD_URL` in
`scripts/lib/environments.mjs` for the Cloudflare step (§7).

Verify no tokens remain:
`grep -rIn -e "project-name" -e "project_name" -e "REPLACE_WITH_TODAY" .` and
`find . -name "*REPLACE_WITH_TODAY*"` (the only matches
should be in `.edge-stack.json` if you chose to keep the literal key, and any intended
`-staging`/`-prod`/`-local`/`-preview` names — all already containing the slug).

## 4. Version manifest

The copied `.edge-stack.json` records the stack + capability versions the project was created
with: `createdWith` and `capabilities.base` are the template's version, so leave them as
copied. The default manifest tracks **only `base`**. Base ships built-in end-user auth
(better-auth) and the admin app — those are part of `base`, not standalone capabilities. Only
capabilities actually installed with `add-edge-capability` belong in the manifest.

## 5. Install and test

```bash
cd "$TARGET"
pnpm install
pnpm --filter tests exec playwright install --with-deps chromium   # first run only
pnpm test
```

If Playwright browsers can't be installed in this environment, run `pnpm type-check` and
`pnpm build` instead and tell the user to run `pnpm test` locally. Report results honestly.

## 6. GitHub setup

Walk the user through (offer to run the `gh` commands):

1. Create the repo: `gh repo create <owner>/<project-name> --private --source=. --remote=origin`
   (init git + initial commit first if not done).
2. **Repo secret** (`gh secret set`): `CLOUDFLARE_API_TOKEN` (created in §7.1). That is the
   **only** required one, and there are **no repo variables** — everything else is derived by
   convention (D1/Worker names from the slug, preview names from the branch, the Cloudflare
   account id and workers.dev subdomain from the token).
   - Optional: `CLOUDFLARE_ACCOUNT_ID`, needed **only** if the token can see more than one
     account — deploys fail with the candidate list if so. Don't set it preemptively.
   - Optional: `CLAUDE_CODE_OAUTH_TOKEN`, only if they want `.github/workflows/claude.yml`.
3. Push. The workflows in `.github/workflows/` then drive e2e, preview, staging, and prod
   (every push to `main` deploys both staging and prod; every other branch gets a preview).
   None of them works on an empty Cloudflare account — do §7 before the first push, or
   expect the first runs to fail until it is done.
4. **PR screenshots.** The project's `CLAUDE.md` and PR template ask for screenshots (and a
   video when an interaction needs showing) on every user-visible change, uploaded as GitHub
   attachments (`gh pr create --attach`, gh 2.99+). Nothing to set up.

   If they work from **Claude Code on the web** (§1), suggest the `pr-media-r2` capability
   (`add-edge-capability`). A cloud session's GitHub writes store `![alt](url)` as
   `[alt](url)`, so its images arrive as bare links
   ([anthropics/claude-code#89540](https://github.com/anthropics/claude-code/issues/89540)),
   and its `gh` may be too old or not signed in. The capability uploads to an R2 bucket
   instead and restores the `!` from CI. Mention the trade-off: the bucket is public-read
   (unguessable keys, 30-day expiry), and it needs a `CLOUDFLARE_API_TOKEN` with R2 write
   access in the cloud environment. Never install it unasked.

## 7. Cloudflare setup

If the user wants **Postgres instead of D1**, install the `neon-postgres` capability with
`add-edge-capability` first (right after §5) and follow its `INSTALL.md` for the database
side instead of the D1 steps below (§7.2 and §7.6) — it needs a Neon project and a
`NEON_API_KEY` repo secret, and no D1 at all. The token (§7.1), domains (§7.3), Workers
(§7.4) and auth secret (§7.5) are the same either way.

**A fresh project has nothing on Cloudflare, and the workflows do not bootstrap all of it.**
The `<project-name>` and `<project-name>-staging` Workers exist only once something has
`wrangler deploy`ed them, which `staging-deploy.yml` and `prod-deploy.yml` do on the first
push to `main` — but a push to any **other** branch runs `preview-deploy.yml`, which clones
the `<project-name>-staging` D1 and uploads a version of the `<project-name>-staging`
Worker, and `wrangler versions upload` refuses a Worker that has never been deployed. The
auth secret is a Worker secret too: previews are versions of the staging Worker and use
its `BETTER_AUTH_SECRET`; with none set, every sign-in fails. So a project that starts life
on a branch (a cloud session, a scaffold landed through a PR, a protected `main`) cannot
deploy at all until §7.1–§7.5 are done.

**Every step below is therefore done by you or explicitly handed to the user — never
assumed.** When you have Cloudflare auth (`CLOUDFLARE_API_TOKEN` in the environment, or
`wrangler whoami` succeeds — offer `! wrangler login`) and GitHub auth (`gh auth status`),
run the commands yourself and report each result. When you don't, give the user the exact
commands, slug filled in, in this order, and say what stays broken until they run them.
Either way, list in §8 which steps ran and which are pending.

1. **API token.** Create **one** account-scoped API token with Workers Scripts: Edit + D1:
   Edit, and set it as the `CLOUDFLARE_API_TOKEN` repo secret (§6). All four Cloudflare
   workflows share it. Nothing deploys before this.
2. **D1 databases** — both are found by **name** at deploy time; no UUID is ever recorded:
   - `wrangler d1 create <project-name>-prod` — must exist before the first push to `main`:
     prod-deploy resolves it and deliberately refuses to create it.
   - `wrangler d1 create <project-name>-staging` — must exist before the first non-`main`
     push: previews clone it (staging-deploy would create it, but only runs on `main`).
3. **Domains** in `scripts/lib/environments.mjs`: replace `REPLACE_WITH_PROD_URL` with the
   production hostname end-users will hit (no scheme, e.g.
   `<project-name>.<subdomain>.workers.dev` or `app.example.com`). Add any additional
   production or staging hostnames to the corresponding arrays. The canonical URL is
   better-auth's safe fallback; an allowlisted request host wins, so the same Worker version
   can serve multiple domains. These values can't be derived because custom domains are
   unknowable from the project name.
4. **Create the Workers** with their first deploy. Pick whichever fits where the project is:
   - **The project is on `main`** (the normal case for a new repo): push it. staging-deploy
     deploys `<project-name>-staging`, prod-deploy migrates `<project-name>-prod` and
     deploys `<project-name>`. Done.
   - **`main` already carries the workflows, the work is on a branch:**
     `gh workflow run staging-deploy.yml --ref main` creates the staging Worker now;
     production waits for the merge (prod-deploy has no manual trigger, on purpose).
   - **No usable `main` yet** (the scaffold is on a branch, `main` is empty or protected):
     deploy staging by hand from the project root. `<subdomain>` is the account's
     workers.dev subdomain (Workers & Pages → Overview in the dashboard):
     ```bash
     pnpm build
     DB_ID=$(pnpm --silent --filter @app/backend exec wrangler d1 info <project-name>-staging --json | jq -r .uuid)
     TARGET=staging DB_NAME=<project-name>-staging DB_ID=$DB_ID \
       DEPLOY_ORIGIN=https://<project-name>-staging.<subdomain>.workers.dev \
       node scripts/gen-wrangler-config.mjs
     pnpm --filter @app/backend exec wrangler d1 migrations apply DB --config dist/worker/wrangler.generated.staging.json --remote
     pnpm --filter @app/backend exec wrangler deploy --config dist/worker/wrangler.generated.staging.json
     ```
     Production the same way, only when the user wants it before the merge:
     `pnpm db:migrate:remote && pnpm run deploy` (both resolve `<project-name>-prod` by
     name). The next push to `main` deploys over either, harmlessly.
5. **Auth secret**, on each Worker **after** §7.4 created it — a different random value per
   Worker, piped in so it never appears in the transcript or a file:
   ```bash
   openssl rand -base64 32 | pnpm --filter @app/backend exec wrangler secret put BETTER_AUTH_SECRET --name <project-name>-staging
   openssl rand -base64 32 | pnpm --filter @app/backend exec wrangler secret put BETTER_AUTH_SECRET --name <project-name>
   ```
   Previews inherit the staging Worker's; nothing is set per branch. If wrangler says there
   is no such Worker and offers to create one, decline and do §7.4 first. Setting it
   deploys a new version of that Worker, which is expected.
6. **Production data.** Apply migrations: `pnpm db:migrate:remote` (unless §7.4 already did,
   via prod-deploy or by hand). The staging D1 is migrated by staging-deploy on every push
   to `main` (seed staging data as needed). Then create the first admin account:
   `pnpm admin:create --username <u> --password <p> --db-name <project-name>-prod` (end-users
   are created from the admin app at `/admin` — there is no self-service sign-up).
7. Explain the preview model: pushing any non-`main` branch clones the
   `<project-name>-staging` DB into a fresh per-branch D1 and uploads a preview Worker
   version with a stable per-branch URL (commented on the PR). See the generated `docs/deployment.md`.

## 8. Wrap up

Summarize: where the project is, that install + tests ran (with results), the `.edge-stack.json`
versions, and the §6/§7 setup as a checklist — each step done (by you, with its result) or
pending (with the exact command and what fails until it runs: no preview before §7.1, §7.2,
§7.4 and §7.5 for staging; no production deploy before §7.2 for prod). Point the user at the
generated `README.md` for the full workflow, and note they can later run `update-edge-stack`
to upgrade and `add-edge-capability` to add features — `production-hardening` before the
app has real users.
