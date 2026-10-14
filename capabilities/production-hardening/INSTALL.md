# Install: `production-hardening`

> This file is the **install contract** that `add-edge-capability` executes, top to bottom.
> `install/` holds the **new** files; `install-patches/` holds one **git patch per existing
> project file** the capability modifies; `with/<capability>/` holds the glue applied when
> the project also has that capability. Nothing here asks you to hand-edit a file from a
> prose description — apply the patch, and fall back to merging by intent only when a patch
> conflicts.

Isolates production from staging, previews and laptops. The code half is small and
mechanical (steps 1–5). **Most of this capability is the Setup section** — account, GitHub
and Cloudflare Access configuration only the user can do. Walk them through it, one step at a
time, offering to run each `gh` / `wrangler` command. `README.md` summarises it; the
installed `docs/production.md` is the project-side reference.

## Before you install

Tell the user up front, and stop if they cannot meet the first two:

- **Production must be on a custom domain**, in a zone in Cloudflare. Production Workers lose
  their `workers.dev` URL, so a production host under `workers.dev` (or an unfilled
  `REPLACE_WITH_PROD_URL` in `scripts/lib/environments.mjs`) has to move first. The admin
  Worker needs a hostname too (e.g. `admin.<their-domain>`).
- **GitHub environments and rulesets** need a public repository, or GitHub Pro / Team for a
  private one.
- **The deploy guards fail every deploy until the accounts are split.** Do Setup §1–§3
  before pushing the branch that carries this install — its own preview already runs against
  the new non-production account — and merge only after Setup §4.
- With `neon-postgres`: one more secret per side (`DB_APP_PASSWORD`), and a second Neon
  project. With `email-sending`: the non-production account needs its own sender domain in
  Email Routing (and Workers Paid) for staging and previews to send real mail.

## Steps

### 1. Copy the new files and apply the patches

From the project root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/capabilities/production-hardening"
```

New files:

```
apps/admin-backend/        # the admin Worker: package.json, tsconfig, vite + wrangler config, src/
docs/production.md         # the project's production reference
```

| Patch | What it does |
| --- | --- |
| `apps/backend/src/index.ts`, `package.json`, `tsconfig.json` | drops `adminApp` and every admin dependency from the end-user Worker |
| `apps/backend/wrangler.jsonc` | `run_worker_first` is `/api/*` only |
| `apps/frontend/vite.config.ts` | no `/admin` proxy or redirect: the admin is on its own origin |
| `apps/admin-frontend/vite.config.ts` | proxies `/api` to the admin Worker (8302); redirects `/` and `/admin` to `/admin/` |
| `scripts/assemble-assets.mjs` | `<worker>` argument: each worker stages its own frontend |
| `scripts/lib/environments.mjs` | `adminWorkerName` per target; `workersDev: false` for production |
| `scripts/gen-wrangler-config.mjs` | writes the admin Worker's config beside the backend's (same database binding); stamps `workers_dev` / `preview_urls` |
| `.github/actions/cloudflare-env/action.yml` | `refuse-worker`: fail when the account hosts that Worker |
| `.github/workflows/prod-deploy.yml` | `environment: production`; refuses an account hosting `<slug>-staging`; deploys the admin Worker |
| `.github/workflows/staging-deploy.yml` | refuses an account hosting `<slug>`; deploys the admin Worker |
| `.github/workflows/preview-deploy.yml` | the same guard; uploads an admin preview at the same alias (skipped until the Worker exists); its URL in the PR comment |
| `package.json` | dev scripts run the admin Worker; drops `gen:prod-config`, `deploy` and `db:migrate:remote` — production deploys only from CI |
| `tests/playwright.config.ts`, `tests/e2e/admin/*`, `tests/e2e/logging/request-log.spec.ts`, `tests/e2e/entity-ids.spec.ts` | the admin Worker as a fourth web server (8302, same database); admin calls go to it; the end-user Worker 404s admin routes |
| `eslint.config.mjs`, `.gitignore` | both workers' server code and `public/` |
| `CLAUDE.md` | the admin-isolation rule and the production-deploy rule |
| `README.md`, `docs/architecture.md`, `docs/development.md`, `docs/deployment.md`, `tests/README.md`, `.claude/commands/check-conventions.md` | the two-Worker layout, the accounts, the guards, `docs/production.md` in the index |

### 2. Resolve conflicts

Resolve every conflict marker **by intent**: keep what the other capability added, and this
capability's two-Worker layout and production rules. Never bring back `app.route("/",
adminApp)` in `apps/backend`, or a local production deploy script.

After resolving, `git grep -n "adminApp" apps/backend` must find nothing.

### 3. Apply the glue (with `neon-postgres`)

When the project has `neon-postgres`, the script applies `with/neon-postgres/` right after
step 1 if nothing conflicted; otherwise it says **GLUE PENDING** — once step 2 is done, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/capabilities/production-hardening" --glue-only
```

Installing `neon-postgres` **after** this capability ends the same way: once its conflicts are
resolved, re-run it with `--glue-only`. The glue:

| File | What it does |
| --- | --- |
| `scripts/ensure-app-role.mjs` (new) | creates `<slug_snake>_app` in SQL, sets its password from `DB_APP_PASSWORD`, grants it DML on every table and sequence (not `schema_migrations`), outputs the app-role connection string |
| `.github/actions/neon-env/action.yml` | `refuse-project`: fail before touching a branch when the resolved project has that name |
| `prod-deploy.yml` | refuses `<slug>-staging`; ensures the app role after migrating; binds a Hyperdrive named `<slug>-prod` when one exists |
| `staging-deploy.yml`, `preview-deploy.yml` | `project-name: <slug>-staging`, refuse `<slug>`; ensure the app role; the Workers get its connection string |
| `preview-teardown.yml` | only ever deletes branches in `<slug>-staging` |
| `scripts/gen-wrangler-config.mjs` | `HYPERDRIVE_ID` binds `HYPERDRIVE`; the admin config copies the connection string and Hyperdrive |
| `libs/db-models/src/client.ts` | `HYPERDRIVE.connectionString` wins over `DB_CONNECTION_STRING` (node-postgres) |
| `apps/admin-backend/*` | `dbMiddleware`; `DB_CONNECTION_STRING` instead of the D1 binding; `WORKER_DATABASE_URL` for e2e |
| `tests/playwright.config.ts` | the admin Worker on the test database |
| `docs/database.md`, `docs/deployment.md`, `docs/production.md` | two projects, the app role, Hyperdrive |

A glue patch that does not apply (the project changed that file) is reported as failed:
apply it by intent.

### 4. Record the version

Add `"production-hardening": "<version from capability.json>"` to `capabilities` in
`.edge-stack.json`.

### 5. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

Commit the updated `pnpm-lock.yaml` with the rest: CI installs with `--frozen-lockfile`.
If `vite build` fails with esbuild's "Host version … does not match binary version …", the
first, lockfile-resolving install left a stale platform-binary link: delete every
`node_modules` and run `pnpm install` again.

## Setup (manual — walk the user through it)

Keep the **existing** Cloudflare account and Neon project as **production**: production data
and the domain stay where they are, and only staging and previews — disposable or
recreatable — move. Below, `<slug>` is the project slug and `<app_role>` is
`<slug_snake>_app`.

### 1. A non-production Cloudflare account

1. Create a second account (dashboard → account list → **Add account**). It needs no zone
   (with `email-sending`: a sender domain in Email Routing, and Workers Paid).
2. In it, create an account-scoped API token with **Workers Scripts: Edit** and, on D1,
   **D1: Edit**. Replace the repo secret: `gh secret set CLOUDFLARE_API_TOKEN`. Delete the
   repo `CLOUDFLARE_ACCOUNT_ID` secret if it pointed at the production account.
3. On D1: create the staging database there, with a login to the new account —
   `CLOUDFLARE_ACCOUNT_ID=<new account> wrangler d1 create <slug>-staging`. To keep staging's
   data, `wrangler d1 export <slug>-staging --remote --output staging.sql` from the old
   account first, then `wrangler d1 execute <slug>-staging --remote --file staging.sql` into
   the new one.
4. After the first staging deploy creates the Workers there:
   `wrangler secret put BETTER_AUTH_SECRET --name <slug>-staging` (new account).

### 2. A non-production Neon project (with `neon-postgres`)

1. Create a project named `<slug>-staging`, in the same region as production. Create a
   branch `staging` in it, off its default branch, now — previews branch off it, and
   staging-deploy only creates it on the next push to `main`. It starts empty; migrations
   run on every deploy.
2. Create two **project-scoped** API keys (organization settings → API keys), one per
   project — a key that cannot reach the other project is the point. Pin each key's project
   too, since a project-scoped key may not be able to list projects: repo secrets
   `gh secret set NEON_API_KEY` (the `<slug>-staging` key) and `gh secret set NEON_PROJECT_ID`
   (that project's id); production's pair goes into the environment in §4.
3. Generate two app-role passwords (`openssl rand -base64 32`, at least 16 characters) and
   set the non-production one: `gh secret set DB_APP_PASSWORD`. The deploys create the role;
   nothing to run by hand.
4. In the production project, delete the `staging` branch and every `preview/*` branch.

### 3. Clean the production account

Delete the `<slug>-staging` Worker (Workers & Pages → it → Settings → Delete), and on D1 the
`<slug>-staging` and `<slug>-preview-*` databases (`wrangler d1 delete <name>`), from the
production account. Production deploys refuse an account that still hosts `<slug>-staging`.

Then scope production's token: an account-scoped token on the production account only, with
**Workers Scripts: Edit**, **D1: Edit** on D1, and **Hyperdrive: Read** if §6 applies.

### 4. GitHub

Offer to run these (they need a repo admin; `{owner}/{repo}` is filled by `gh`):

```bash
# The production environment: only main may deploy to it.
gh api -X PUT repos/{owner}/{repo}/environments/production --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
gh api -X POST repos/{owner}/{repo}/environments/production/deployment-branch-policies \
  -f name=main -f type=branch

# Production's secrets — they override the repo's same-named, non-production ones.
gh secret set CLOUDFLARE_API_TOKEN --env production
gh secret set NEON_API_KEY --env production        # neon-postgres: production's project key
gh secret set NEON_PROJECT_ID --env production     # neon-postgres: production's project id
gh secret set DB_APP_PASSWORD --env production     # neon-postgres: the other password from §2.3

# Squash merges only, PR title and body as the commit; delete merged branches (which also
# tears down their previews).
gh api -X PATCH repos/{owner}/{repo} -F allow_squash_merge=true -F allow_merge_commit=false \
  -F allow_rebase_merge=false -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY

# The default branch: PRs only, squash only, e2e green (from GitHub Actions, app 15368),
# no force pushes or deletion — for admins too.
gh api -X POST repos/{owner}/{repo}/rulesets --input - <<'JSON'
{
  "name": "default branch",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [{ "context": "e2e", "integration_id": 15368 }]
      }
    }
  ]
}
JSON
```

Ask before tightening further: `required_approving_review_count: 1` only makes sense with a
second reviewer, `strict_required_status_checks_policy: true` makes every PR rebase onto the
latest `main`, and required reviewers on the environment gate every production deploy.

If production's token sees several accounts, set `CLOUDFLARE_ACCOUNT_ID --env production`
too.

### 5. Cloudflare Access (production account)

1. Turn on Zero Trust (the free plan covers up to 50 users) and pick a team domain.
2. **`/api/health`** — Zero Trust → Access → Applications → **Self-hosted**: domain
   `<production host>`, path `api/health`. Policy: **Service Auth**, including a new service
   token (Access → Service credentials) for the uptime monitor, which then sends
   `CF-Access-Client-Id` / `CF-Access-Client-Secret`. Add an **Allow** policy for the user's
   email to check it from a browser.
3. **The admin Worker** — after the first production deploy creates `<slug>-admin`, attach
   its custom domain (Worker → Settings → Domains & Routes → Add → Custom Domain, e.g.
   `admin.<their-domain>`), then Worker → **Access** → **Protect this Worker behind Access**
   → **All traffic**, allowing the admins' emails.
4. Optional, in the non-production account: Workers & Pages → **Protect all Workers**, so
   staging and previews are not public either.

Confirm with `curl -sS -o /dev/null -w '%{http_code}\n' https://<production host>/api/health`:
it must not be `200` without the service-token headers.

### 6. Hyperdrive (with `neon-postgres` — only if production needs it)

Ask whether production's database latency is a problem; if not, skip this. Otherwise, in the
production account, with production's app-role connection string (the Neon console's
connection details for the default branch, role `<app_role>`, password from §2.3):

```bash
wrangler hyperdrive create <slug>-prod --caching-disabled \
  --connection-string "postgres://<app_role>:<password>@<neon host>/neondb?sslmode=require"
```

Caching stays off because the app reads its own writes. The next production deploy finds the
config by name and binds it (the token needs **Hyperdrive: Read**); deleting it goes back to
direct connections.

### 7. Ship

Push the branch (its preview deploys into the new account; the admin preview starts after
the first staging deploy), check the PR is blocked until `e2e` passes, squash-merge, and
watch the first production deploy in the `production` environment. Then finish §5.3.

## Later: rotating credentials (tell the user when they ask)

- **A Cloudflare token or Neon key** — create the replacement, `gh secret set <NAME> --env
  production` (or without `--env` for the non-production one), then revoke the old one.
- **`DB_APP_PASSWORD`** — set the new secret; the next deploy changes the role's password,
  and the running Workers fail to connect for the seconds until it ships. With Hyperdrive,
  follow it at once with `wrangler hyperdrive update <id> --origin-password <new>`.
- **`BETTER_AUTH_SECRET`** — `wrangler secret put BETTER_AUTH_SECRET` on the Worker, logged in
  to that Worker's account. It signs every end-user out.
- **An Access service token** — create a new one, add it to the policy, update the monitor,
  then revoke the old one.
