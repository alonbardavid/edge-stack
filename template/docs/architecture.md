# Architecture

## Layout

```
apps/
  backend/         Hono API on Cloudflare Workers; also serves both SPAs as static assets
  frontend/        end-user SPA (served at /)
  admin-frontend/  admin SPA (served at /admin)
libs/
  contract/        oRPC API contract shared by backend + frontend
  admin-contract/  oRPC contract for the admin API
  admin-api/       self-contained admin backend
  db-models/       Drizzle schema + D1 helpers, prefixed entity ids
  identity/        end-user authentication (better-auth)
  ds/              design system / theme, incl. the form primitives
  logging/         LogTape configuration + moduleLogger (see its README)
  server-commons/  shared server middleware (errors, request logging)
scripts/           build/deploy helpers
tests/             Playwright e2e
migrations/        D1 SQL migrations
```

Frontend and API are same-origin (the Vite dev servers proxy `/api`), so there is no CORS.

## The API contract

Contract-first [oRPC](https://orpc.dev): procedures are declared in `@lib/contract` /
`@lib/admin-contract` (`oc.route({ method, path }).input().output()`), implemented with
`implement(contract)` and served as plain REST by `OpenAPIHandler`, so every URL is the one
the contract names. Frontends call them through `@orpc/tanstack-query`
(`useQuery(orpc.me.queryOptions())`); query keys follow the contract's nesting
(`orpc.listUsers.key()`), so never hand-write one.

- The end-user `api` implementer runs `requireSession` first: a procedure sees
  `context.requestContext` and an unauthenticated call gets `401 UNAUTHORIZED`.
- Errors are `ORPCError`s. The ones a handler raises itself are declared with `.errors()`
  and thrown with `errors.X()`; anything else is logged and answered as a bare 500.
- Inputs and outputs are both validated.

## End-user authentication

better-auth (email + password) in `@lib/identity` (`getAuth()`), mounted on `/api/auth/*`,
using its Drizzle adapter over D1 with the `user` / `user_sessions` / `user_accounts` /
`user_verifications` tables. Sessions are httpOnly cookies; there is no client token.

There is no self-service sign-up (`emailAndPassword.disableSignUp`). End-users are created
from the admin app, which inserts a verified `user` plus a credential `user_accounts` row via
`createUser` / `setUserPassword`. `user_verifications` exists only because better-auth's
adapter schema expects it.

The base URL is dynamic: a request host listed in `scripts/lib/environments.mjs` wins, and an
unknown host falls back to `FRONTEND_CANONICAL_BASE_URL`, so one Worker version can serve its
workers.dev URL and any custom domains.

## The admin app

`apps/admin-frontend` (at `/admin`) has its own auth, separate from better-auth: `app_admin`
accounts with passwords hashed by `better-auth/crypto`, and an httpOnly `admin_session`
cookie holding a random token row (7-day expiry) that `requireAdmin` validates. Admins cannot
change their own password from the app; only `pnpm admin:create` manages admins.

`@lib/admin-api` exports one Hono app, `adminApp`: public `POST /api/admin/auth/login`, then
the `requireAdmin` gate, then logout, the `@lib/admin-contract` oRPC handler (me, list /
create users, set a user's password) and the admin SPA's assets.

```bash
pnpm admin:create --username <u> --password <p>                          # local D1
pnpm admin:create --username <u> --password <p> --db-name project-name-prod  # any remote D1
```
