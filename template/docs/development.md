# Development

```bash
pnpm dev            # builds first, then runs all three dev servers
pnpm db:new <name>  # create migrations/<timestamp>_<name>.sql
pnpm db:migrate     # apply migrations to the local D1
pnpm build          # bundle the worker and both SPAs
```

The backend runs under `vite dev` on port 8301 — the worker executes in workerd via
`@cloudflare/vite-plugin`, with hot reload — and both frontend dev servers proxy `/api` to
it. Local dev binds the `project-name-local` D1 by name in `apps/backend/wrangler.jsonc`,
with local-dev `vars`; no remote Cloudflare resource is touched.

## The build

The backend is bundled by vite + `@cloudflare/vite-plugin`; `tsc` only type-checks.
Wrangler is the deploy and D1 CLI.

- `apps/backend/wrangler.jsonc` is the build's **input** (`main: "src/index.ts"`).
  `vite build` emits `apps/backend/dist/worker/wrangler.json` plus a redirect at
  `apps/backend/.wrangler/deploy/config.json`, which `scripts/gen-wrangler-config.mjs`
  follows to find it. `viteEnvironment: { name: "worker" }` keeps that dir stable.
- `scripts/assemble-assets.mjs` stages both frontend builds into `apps/backend/public`
  before `vite build`, which copies them into `dist/client/`. So the backend devDepends on
  both frontends — that turbo `^build` edge is load-bearing — and an empty `public/` means
  no `ASSETS` binding. That is why `pnpm dev` and `pnpm test` build first.
- The two frontends stay separate vite apps: the plugin supports one client environment per
  worker, and folding the admin SPA in would break admin isolation.

## Local D1

Dev persists to `apps/backend/.wrangler/state`, where `wrangler d1 … --local` writes, so
`pnpm db:migrate` and `pnpm admin:create` target it. e2e uses its own state in
`.wrangler-test` — see [tests/README.md](../tests/README.md).
