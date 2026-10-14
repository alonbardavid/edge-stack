# project-name

An **edge-stack** project: a pnpm + Turbo monorepo that runs entirely on Cloudflare's
edge — a Hono API and two React (Vite) SPAs served from one Cloudflare Worker, backed by a
Cloudflare D1 (SQLite) database, with Playwright e2e tests and a GitHub Actions pipeline that
gives every pull request its own live preview.

> Scaffolded with the [`create-edge-stack`](https://github.com/alonbardavid/edge-stack) skill.
> The stack version and installed capabilities are tracked in [`.edge-stack.json`](./.edge-stack.json).
> Upgrade later with the `update-edge-stack` skill; add features with `add-edge-capability`.

## Quick start

```bash
pnpm install
pnpm dev          # builds, then runs backend + frontend + admin frontend together
pnpm test         # Playwright e2e (run `pnpm --filter tests exec playwright install` once)
pnpm type-check
pnpm lint
```

Create an admin with `pnpm admin:create --username <u> --password <p>`, then manage
end-users from `/admin`.

## Docs

- [Architecture](docs/architecture.md) — layout, the API contract, authentication, the admin app
- [Logging](libs/logging/README.md) — `moduleLogger`, request context, verbosity
- [Development](docs/development.md) — local dev, the build, local D1
- [Deployment](docs/deployment.md) — preview, staging and production
- [Tests](tests/README.md) — e2e traps
- [Decisions](docs/adrs/) — architecture decision records
