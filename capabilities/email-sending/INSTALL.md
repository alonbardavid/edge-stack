# Install: `email-sending`

> This file is the **install contract** that `add-edge-capability` executes, top to bottom.
> `install/` holds the **new** files; `install-patches/` holds one **git patch per existing
> project file** the capability modifies. Nothing here asks you to hand-edit a file from a
> prose description — apply the patch, and fall back to merging by intent only when a patch
> refuses to apply.

Adds transactional email (`@lib/email-ds`, `@lib/email-service`) and the sign-up /
password-reset flows built on it. `README.md` summarises it; the installed
`docs/emails.md` is the project-side reference.

## Steps

### 1. Copy the new files

Copy everything under `install/` into the project, preserving paths:

```
libs/email-ds/                                    # whole new workspace package
libs/email-service/                               # whole new workspace package
libs/contract/src/constants.ts                    # PRODUCT_DISPLAY_NAME
libs/identity/src/emails/{index.ts, verify-email.tsx, reset-password.tsx}
apps/frontend/src/screens/signup/SignUpScreen.tsx
apps/frontend/src/screens/forgot-password/ForgotPasswordScreen.tsx
apps/frontend/src/screens/reset-password/ResetPasswordScreen.tsx
emails/{verify-email.tsx, reset-password.tsx}     # re-export shims for the preview server
tests/e2e/auth/{signup.spec.ts, forgot-password.spec.ts}
tests/e2e/email/{index.ts, inbox.ts, open.ts}
docs/emails.md                                    # the project's email reference
```

Replace the `project-name` / `project_name` placeholders with the project's slug (from
`.edge-stack.json` `name`).

### 2. Decide the two values the patches carry as placeholders

Both appear inside the patch text; settle them now so step 3 can render them.

- **Product display name** — shown in emails, the frontend `<title>`, and asserted in
  `signup.spec.ts` and `forgot-password.spec.ts`. Defaults to the project slug. Ask the user
  if they want something different (e.g. "Acme Notes"); if so, set it in
  `libs/contract/src/constants.ts` (copied in step 1) and replace the product-name text in the
  email metadata/body assertions in both specs.
- **Sender address** — the patches insert the literal `REPLACE_WITH_EMAIL_FROM` into the three
  deploy workflows and the root `gen:prod-config` script. It must be on a domain the
  Cloudflare account can send from (see **Real delivery** below). If the project's
  `REPLACE_WITH_PROD_URL` placeholder has already been filled in, ask the user for their
  address (e.g. `noreply@<their-domain>`) and substitute it too; otherwise leave the
  placeholder for Cloudflare setup.

  Every target gets the **same, bare** address — only `EMAIL_TAG` differs (see the generator
  patch), so the address is filled in once per file and never duplicated per environment.

### 3. Apply the patches to existing files

`install-patches/` mirrors the project tree: `install-patches/<path-to-file>.patch` is a
`git diff` against that file in an unmodified base-`0.2.0` project.

**Render the placeholders first, then apply.** Patch context lines contain `project-name` /
`project_name`, so applying a raw patch to an already-renamed project fails on context
mismatch. Copy `install-patches/` to a temp dir, substitute the project's slug (and the
step-2 values) throughout the patch text, then apply from the project root:

```bash
git apply <rendered-patch-dir>/<path>.patch      # per file, or pass them all at once
```

Check first with `git apply --check` and report anything that fails rather than pushing on.

**If a patch does not apply** (the file was locally modified), in order:

1. `git apply -3 <patch>` — 3-way merge; resolve any conflict markers it leaves. This
   reconstructs the pre-image from the patch's blob hashes, so it works when the project has
   the untouched base version of the file somewhere in its git history (true for anything
   scaffolded by `create-edge-stack` and committed). If the blob is missing, git says so and
   you fall through to (2).
2. Read the patch and apply its change **by intent** (merge, don't clobber), then tell the
   user exactly what you merged and why the patch didn't apply.

Do not silently skip a patch — every one of these is load-bearing.

| Patch | What it does |
| --- | --- |
| `package.json` | `email:dev` preview-server script; root devDeps the react-email preview bundler resolves from the repo root (`react`, `react-dom`, `react-email`, `@react-email/*`, `@lib/contract`, `@lib/email-ds`); `EMAIL_FROM` in `gen:prod-config` |
| `libs/contract/package.json` | `./constants` export subpath, so lightweight consumers (vite config, email-ds globals) import `PRODUCT_DISPLAY_NAME` without pulling in the oRPC contract |
| `libs/contract/src/index.ts` | re-exports `PRODUCT_DISPLAY_NAME` |
| `libs/identity/package.json` | email + react deps, `@types/react` |
| `libs/identity/tsconfig.json` | `jsx: react-jsx` + `DOM` lib — the templates are `.tsx` |
| `libs/identity/src/auth.ts` | flips `disableSignUp` to `false` with `requireEmailVerification`, adds `sendResetPassword`, the `emailVerification` block, and the `hooks.before` duplicate-email guard |
| `tests/package.json` | adds the test-only `postal-mime` parser used to decode simulated `.eml` messages before Playwright mounts them |
| `apps/backend/src/env.d.ts` | `SEND_EMAIL` + `EMAIL_FROM` on the Worker env |
| `apps/backend/wrangler.jsonc` | `send_email` binding + the local-dev sender `noreply+local@<slug>.local` |
| `apps/backend/vite.config.ts` | aliases `react-dom/server.edge` → `react-dom/server.browser`: `@react-email/render`'s workerd build imports `server.edge`, which react-dom 18 does not export, so the vite worker build fails without it |
| `scripts/gen-wrangler-config.mjs` | carries `EMAIL_FROM` into generated configs, tagged per environment via the new `taggedSender()` / optional `EMAIL_TAG` |
| `.github/workflows/preview-deploy.yml` | `EMAIL_FROM` + `EMAIL_TAG: ${{ steps.names.outputs.alias }}` — each preview gets its own sender tag |
| `.github/workflows/staging-deploy.yml` | `EMAIL_FROM` + `EMAIL_TAG: staging` |
| `.github/workflows/prod-deploy.yml` | `EMAIL_FROM` only — production is the one environment that sends untagged |
| `apps/frontend/src/logic/authentication/client.ts` | exports `signUp`, `requestPasswordReset`, `resetPassword` |
| `apps/frontend/src/App.tsx` | routes for `/signup`, `/forgot-password`, `/reset-password` |
| `apps/frontend/src/screens/login/LoginScreen.tsx` | "Forgot password?" and "Sign up" links |
| `apps/frontend/index.html` | `<title>` becomes the `%PRODUCT_NAME%` build-time token |
| `apps/frontend/vite.config.ts` | the `transformIndexHtml` plugin that fills that token |
| `CLAUDE.md` | the email, product-name and sender-tag rules |
| `README.md` | links `docs/emails.md` from the docs index |
| `docs/architecture.md` | sign-up and password reset are now by email |

The doc patches are the likeliest to need the intent fallback, since a project edits its docs
most. Their hunks are independent, so apply what lands and merge the rest.

Note that a tagged target fails loudly at config-generation time while
`REPLACE_WITH_EMAIL_FROM` is still unfilled (it is not a `local@domain` address) — expected
until Cloudflare setup.

### 4. Record the version

Add `"email-sending": "<version from capability.json>"` to `capabilities` in
`.edge-stack.json`.

### 5. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

The new e2e specs (`signup.spec.ts`, `forgot-password.spec.ts`) drive the full flows against
the simulated inbox; no secret is needed. Optionally show the user `pnpm email:dev`
(http://localhost:3100) to preview the templates.

## Real delivery (manual, tell the user)

Local dev and e2e need nothing. For real outbound email from the deployed Worker:

- The `send_email` binding requires a **Workers Paid** plan and a **verified sender**: the
  `EMAIL_FROM` domain must be onboarded in Cloudflare (Email Routing on the zone, with the
  destination/sender verified). Until then, deployed sends will fail at runtime even though
  code/config are wired.
- Once they know the address, fill `REPLACE_WITH_EMAIL_FROM` in `preview-deploy.yml`,
  `staging-deploy.yml`, `prod-deploy.yml`, and the root `gen:prod-config` script (step 2) —
  the same bare address in all four; the `+environment` tag is added by the generator. No new
  secret is involved — `EMAIL_FROM` is a plain var.
- Cloudflare Email Routing matches the address's local part exactly, so a verified sender
  covers the bare address only. If the account rejects the tagged non-production senders,
  either add catch-all/`noreply+*` routing for the domain or point the non-production targets
  at a domain the user is happy to send test mail from.
