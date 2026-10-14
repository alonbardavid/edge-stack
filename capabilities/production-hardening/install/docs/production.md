# Production

Production is isolated from everything else; most of that isolation lives in Cloudflare and
GitHub settings rather than in code. This page describes what is isolated and how.

## Two Cloudflare accounts

| Account            | Holds                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **production**     | the `project-name` and `project-name-admin` Workers, the `project-name-prod` D1, the zone |
| **non-production** | the `-staging` Workers and their previews, the `project-name-staging` and preview D1s     |

Each account has its own CI token, scoped to that account alone, so neither side's
credentials can touch the other's resources. Each deploy also proves it reached the right
account: `.github/actions/cloudflare-env` fails when the account hosts a Worker only the other
account should (`refuse-worker`).

Production Workers have `workers_dev` and `preview_urls` off (`scripts/lib/environments.mjs`):
they answer only on their custom domains — the app's on `project-name`, a separate hostname on
`project-name-admin` — so nothing reaches them around Cloudflare Access or a WAF rule.

## GitHub

- **`production` environment** — only `main` may deploy to it, and only `prod-deploy.yml`
  names it. Its secrets (`CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID` when the token
  sees several accounts) override the repo secrets of the same name, which hold the
  non-production values. No other workflow, and no workflow edited on a branch, can read
  production's secrets.
- **Ruleset on the default branch** — changes land only through a pull request, merged by
  squash; the `e2e` check (from GitHub Actions) must pass; no force pushes, no deletion.
- **Merge settings** — squash only, with the PR title and body as the commit; head branches
  are deleted on merge, which also tears down their previews.

## Cloudflare Access

- **`/api/health`** sits behind an Access application on the production host, so its report
  (which names the database's state) is not public. Uptime monitors authenticate with an
  Access service token (`CF-Access-Client-Id` / `CF-Access-Client-Secret` headers).
- **The admin Worker** is protected as a Worker, which covers every domain it answers on:
  admins sign in to Access first, then to the admin app.

The Worker does not validate Access's JWT itself. That is safe only while production has no
`workers.dev` or preview URL — keep `workersDev: false` for production.
