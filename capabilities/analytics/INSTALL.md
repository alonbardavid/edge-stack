# Install: `analytics`

> This file is the **install contract** that `add-edge-capability` executes, top to bottom.
> `install/` holds the **new** files; `install-patches/` holds one **git patch per existing
> project file** the capability modifies. Nothing here asks you to hand-edit a file from a
> prose description — apply the patch, and fall back to merging by intent only when a patch
> conflicts.

Adds PostHog product analytics to the Worker (`@lib/analytics-server`) and the end-user SPA
(`posthog-js`), and turns Cloudflare Web Analytics off for the production hostname.
`README.md` summarises it; the installed `docs/analytics.md` is the project-side reference.

## Before you install

Ask the user for their **PostHog project**: its ingestion host (`https://us.i.posthog.com`
for US Cloud, `https://eu.i.posthog.com` for EU Cloud, or their own) and its **project
token** (`phc_…`, under Project settings). The token is public by design — it can only write
events and ships in every browser bundle — so it is committed, never a secret.

If they have no project yet, install anyway and leave both placeholders: local dev, e2e,
previews and staging only log events, so nothing needs them. Production needs them filled in
`libs/contract/src/analytics.ts` before it can deliver, so say so in the wrap-up.

## Steps

### 1. Copy the new files and apply the patches

From the project root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/capabilities/analytics" \
  --set REPLACE_WITH_POSTHOG_HOST=<host> --set REPLACE_WITH_POSTHOG_TOKEN=<phc_…>
```

Drop the two `--set`s when the user has no project yet. The script copies `install/`
(rendering `project-name` / `project_name` / `REPLACE_WITH_TODAY` and the `--set` tokens),
renders the same placeholders in each patch, and applies it; a patch that no longer applies
is retried as a real 3-way merge, and every file is reported as applied, 3-way merged,
conflicted, or failed (exit code 2 if anything needs you). New files:

```
libs/analytics-server/                          # whole new workspace package
libs/contract/src/analytics.ts                  # POSTHOG_HOST + POSTHOG_PROJECT_TOKEN
libs/identity/src/analytics-hooks.ts            # signed_up / signed_in from better-auth's writes
apps/frontend/src/logic/analytics/{client.ts, AnalyticsTracker.tsx}
tests/e2e/analytics/{analytics.spec.ts, events.ts}
docs/analytics.md                               # the project's analytics reference
```

| Patch | What it does |
| --- | --- |
| `apps/backend/src/index.ts` | `app.use("/api/*", analyticsMiddleware)` right after the request logger, before every route |
| `apps/backend/package.json`, `tsconfig.json` | depend on / reference `@lib/analytics-server` |
| `libs/identity/src/auth.ts` | `databaseHooks: analyticsHooks` |
| `libs/identity/package.json`, `tsconfig.json` | depend on / reference `@lib/analytics-server` |
| `libs/contract/src/index.ts` | re-exports the PostHog host and token |
| `apps/frontend/package.json` | `posthog-js` |
| `apps/frontend/src/main.tsx` | mounts `<AnalyticsTracker />` beside `<App />` |
| `apps/frontend/src/logic/authentication/useMe.ts` | exposes `userId` |
| `apps/frontend/src/logic/authentication/useLogout.ts` | `signed_out`, then `analytics.reset()` |
| `apps/frontend/vite.config.ts`, `src/vite-env.d.ts` | the build-time `__ANALYTICS_DELIVER__` flag from `ENVIRONMENT` / `ANALYTICS_ENABLED` |
| `eslint.config.mjs` | rejects importing `posthog-js` outside `logic/analytics/client.ts` |
| `turbo.json` | `ENVIRONMENT` and `ANALYTICS_ENABLED` on the build task's `env`, so a cached bundle is never replayed for another target |
| `scripts/lib/environments.mjs` | each target's `environment` (a preview is `staging`) |
| `scripts/gen-wrangler-config.mjs` | stamps `ENVIRONMENT` and `ANALYTICS_ENABLED` vars |
| `package.json` | `pnpm deploy` builds with `ENVIRONMENT=production` |
| `.github/workflows/prod-deploy.yml` | builds as `production` |
| `.github/workflows/staging-deploy.yml` | builds as `staging` |
| `.github/workflows/preview-deploy.yml` | builds as `staging`; a `workflow_dispatch` input sets `ANALYTICS_ENABLED` for the build and the generator |
| `CLAUDE.md` | the one-emitter-per-fact rule |
| `README.md` | links `docs/analytics.md` from the docs index |
| `docs/architecture.md` | `analytics-server/` in the layout |

### 2. Resolve conflicts

Resolve every conflict marker **by intent**: keep what the other side added for its own
feature, and add this capability's lines beside it. `analyticsMiddleware` stays on `/api/*`
after every other request middleware and before the first route, and every production build
(the prod workflow, and `pnpm deploy` where the project still has it) runs with
`ENVIRONMENT=production`. Tell the user which files needed merging and why.

On a project that has edited its own docs, the doc patches are the likeliest to need the
intent fallback; their hunks are independent, so apply what lands and merge the rest.

### 3. Turn off Cloudflare Web Analytics for the production hostname

PostHog replaces it. With Web Analytics on, Cloudflare injects its own beacon
(`static.cloudflareinsights.com/beacon.min.js`) into every HTML page the zone serves — a
second tracker nobody configured. Nothing to do while `REPLACE_WITH_PROD_URL` is unfilled or
the hostname is a `*.workers.dev` one; otherwise check whether it is on:

```bash
curl -s "https://<prod-host>/" | grep -c cloudflareinsights   # 0 means off
```

If it is on, this is an account-level change, so confirm with the user first, then either:

- **Dashboard** (preferred): Analytics & Logs → Web Analytics → the site for the hostname's
  zone → **Manage site** → **Disable**. If the zone also serves other sites the user wants
  measured, add an exclude rule for the production hostname instead of disabling the site.
- **API**: needs a token with *Account Settings: Edit*. The CI token deliberately lacks it —
  do not add it there; use a short-lived token of the user's own.

  ```bash
  CF=https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/rum/site_info
  curl -s -H "Authorization: Bearer $TOKEN" "$CF/list?per_page=100" \
    | jq '.result[] | {site_tag, zone: .ruleset.zone_name, auto_install}'
  curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$CF/<site_tag>"   # the hostname's zone
  ```

Re-run the `curl … | grep` check (after a cache purge if the page is cached) and report the
result.

### 4. Record the version

Add `"analytics": "<version from capability.json>"` to `capabilities` in `.edge-stack.json`.

### 5. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

`tests/e2e/analytics/analytics.spec.ts` reads the browser's `[analytics]` console lines and
the Worker's `analytics event` log lines: a page view with its ids masked, the sign-in
identified in the browser and recorded by the Worker, and `signed_out`. No PostHog project is
needed — nothing outside production delivers.

## Real delivery (tell the user)

- Production delivers from its first deploy once the host and token are filled. Events arrive
  in the PostHog project under `app_side: "browser"` and `app_side: "server"`.
- To check a tracking change from a branch before merging it, run **Preview Version Upload**
  by hand on that branch (Actions tab → Run workflow) with **Deliver analytics** ticked; the
  next push uploads a logging preview again. Its events land in the same project, under the
  preview's own URL.
- Previews and staging otherwise send nothing, so PostHog only ever holds production data.
- Cloudflare Web Analytics stays off for every production hostname they add later (step 3).
