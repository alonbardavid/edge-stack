# Emails

Transactional email is react-email components rendered to HTML in the Worker and sent
through Cloudflare's `send_email` binding. Runtime rendering adds ~184 kB gzip to the Worker
(react, react-dom/server, `@react-email/*`) — accepted over a build-time template pipeline.

## Packages

- `@lib/email-ds` — the email design system: `EmailLayout`, `renderEmail(template, props)`,
  the `EmailTemplate` / `RenderedEmail` types, and `emailGlobals` (the product name, from
  `PRODUCT_DISPLAY_NAME`). Separate from `@lib/ds`, which is the Mantine app UI.
- `@lib/email-service` — `sendEmail({ to, subject, html, text?, fromName? })`, from the
  `EMAIL_FROM` var. It stays product-agnostic; the caller passes `fromName`.
- A template lives with the service that sends it — today `libs/identity/src/emails/`.

## Templates

A template file default-exports a component built from `@react-email/components` with
**inline `style` objects** — never the `<Tailwind>` component, which trips workerd's script
startup CPU limit. It also exports a `subject` and sets `Component.PreviewProps`. Only
per-send data (`name`, `url`) are props; brand constants come from `emailGlobals`.

To add one: create `<service>/src/emails/<name>.tsx`, export it typed from that folder's
`index.ts`, and add a re-export shim in root `emails/` so `pnpm email:dev`
(http://localhost:3100) previews it.

## Sign-up and password reset

Sign-up requires email verification: `POST /api/auth/sign-up/email` creates an unverified
user and sends `verify-email`; the link verifies and signs the user in. An unverified
sign-in gets `403 EMAIL_NOT_VERIFIED`, and a duplicate email gets `422 USER_ALREADY_EXISTS`
from a `hooks.before` guard. Forgot-password sends `reset-password`. Verification tokens are
stateless JWTs signed with `BETTER_AUTH_SECRET`.

## Senders per environment

Only production sends from the bare address. `taggedSender()` in
`scripts/gen-wrangler-config.mjs` adds the target's `EMAIL_TAG` to the local part at
config-generation time: `noreply+staging@…`, `noreply+<branch-alias>@…` for a preview, and
`noreply+local@…` (by hand in `wrangler.jsonc`) for local dev and e2e.

## Local and e2e

Local `vite dev` (miniflare) simulates sends and writes `.eml` files under
`<os-tmpdir>/miniflare-*/email/`. The e2e helpers in `tests/e2e/email/` parse them with
`postal-mime`, matching on the recipient, and mount the HTML in a Playwright page so specs use
ordinary locators.
