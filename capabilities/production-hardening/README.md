# Capability: `production-hardening`

Makes production impossible to touch from anywhere but its own deploy. Most of it is
configuration the user does by hand, guided by `INSTALL.md`; the code side is:

- **The admin app in its own Worker** (`apps/admin-backend`): the end-user Worker no longer
  contains admin code, and the admin Worker can sit behind Cloudflare Access as a whole.
- **Production answers only on custom domains** — `workers_dev` and `preview_urls` off in
  its generated configs, so Access and WAF rules cannot be bypassed.
- **Account guards** — every deploy fails when its Cloudflare account hosts a Worker only the
  other side should (`refuse-worker` in `.github/actions/cloudflare-env`).
- **A `production` GitHub environment** for `prod-deploy.yml`; its secrets override the
  repo's non-production ones. No local production deploy scripts remain.
- With `neon-postgres` (glue in `with/neon-postgres/`): a separate non-production Neon
  project, guarded the same way; the Workers connect as a restricted role
  (`scripts/ensure-app-role.mjs`) instead of the owner; and production binds a Hyperdrive
  config when one named `<slug>-prod` exists.

The manual side: split the Cloudflare account (and Neon project), scope a token per side,
create the GitHub environment, a default-branch ruleset (PR + green `e2e` + squash only) and
the merge settings, and put `/api/health` and the admin Worker behind Cloudflare Access.

`INSTALL.md` is the contract `add-edge-capability` executes. The installed
`docs/production.md` is the project-side reference.
