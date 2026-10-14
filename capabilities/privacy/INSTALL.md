# Install: `privacy`

> This file is the **install contract** that `add-edge-capability` executes, top to bottom.
> `install/` holds the **new** files; `install-patches/` holds one **git patch per existing
> project file** the capability modifies, cut against the template with `analytics`
> installed. Nothing here asks you to hand-edit a file from a prose description — apply the
> patch, and fall back to merging by intent only when a patch conflicts.

Adds regional tracking consent on top of `analytics`, a privacy policy page linked from
every screen, and deleting, restoring and erasing ("nuking") end-users to the admin app.
`README.md` summarises it; the installed `docs/privacy.md` is the project-side reference.

## Before you install

- **`analytics` is a prerequisite.** If `.edge-stack.json` has no `analytics`, stop: offer to
  install `analytics` first, then this. The script refuses to run without it. If the user
  still wants privacy without analytics, do not run the script: carry over by hand, using
  your judgement, only the parts that stand on their own — the policy page and footer, the
  admin delete / restore / nuke, the deleted-account sign-in refusal and the `nuked_at`
  migration — leaving out everything about tracking, consent and PostHog, and adjust the
  policy text, docs and tests to match.
- Ask the user for the **privacy contact address** — where data requests go (e.g.
  `privacy@<their-domain>`). The policy names it. If they have none yet, install anyway and
  leave the placeholder; it must be filled in `apps/frontend/src/screens/privacy/content.ts`
  before launch, so say so in the wrap-up.
- Tell them the shipped policy is **minimal on purpose** and not legal advice, and that they
  should replace it with their own — ideally one written or reviewed by a lawyer. Walk them
  through **The privacy policy** below before the wrap-up.

## Steps

### 1. Copy the new files and apply the patches

From the project root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-edge-capability/apply-capability.mjs" \
  "${CLAUDE_PLUGIN_ROOT}/capabilities/privacy" \
  --set REPLACE_WITH_PRIVACY_EMAIL=<address>
```

Drop the `--set` when the user has no address yet. The script copies `install/` (rendering
`project-name` / `project_name` / `REPLACE_WITH_TODAY` and the `--set` token), renders the
same placeholders in each patch, and applies it; a patch that no longer applies is retried
as a real 3-way merge against the file as the template has it with `analytics` installed,
and every file is reported as applied, 3-way merged, conflicted, or failed (exit code 2 if
anything needs you). New files:

```
libs/contract/src/privacy-schemas.ts             # regimes, tracking settings, the public contract
libs/db-models/src/schemas/tracking.ts           # tracking_settings
migrations/REPLACE_WITH_NOW_{privacy,tracking_settings}.sql
libs/analytics-server/src/{tracking.ts, persons.ts}  # the table's reads and writes; PostHog erasure
libs/identity/src/deleted-accounts.ts            # refuses a deleted account's sign-in
libs/admin-api/src/users/lifecycle.ts            # delete / restore / nuke, per-user tracking
apps/backend/src/privacy/region.ts, apps/backend/src/routes/privacy.ts
apps/frontend/src/logic/privacy/*, src/logic/api/publicOrpc.ts   # the public oRPC client
apps/frontend/src/components/{ConsentBanner.tsx, PrivacyFooter.tsx}
apps/frontend/src/screens/privacy/{PrivacyScreen, PrivacySettingsScreen, DoNotSellScreen}.tsx, content.ts
apps/admin-frontend/src/screens/users/{useUserLifecycle.ts, NukeConfirm.tsx}
tests/e2e/privacy/{privacy-page.spec.ts, consent.spec.ts, consent-state.ts}
tests/e2e/admin/admin-lifecycle.spec.ts
docs/privacy.md                                  # the project's privacy reference
```

| Patch | What it does |
| --- | --- |
| `apps/backend/src/index.ts` | `GET /api/public/privacy-config` as a Hono route before the oRPC handler (it reads `request.cf`); `PUT /api/privacy/tracking` in the session-gated router |
| `libs/contract/src/index.ts` | the privacy routes and vocabulary |
| `libs/db-models/src/index.ts`, `entity-ids.ts`, `schemas/auth.ts` | `trackingSettings` and `inArray` exported; the `TRACKING_SETTING` id prefix; `user.nukedAt` |
| `libs/analytics-server/src/scope.ts`, `environment.ts`, `index.ts`, `package.json`, `tsconfig.json` | every batch drops opted-out users' events; `isProductionEnvironment`; the tracking and erasure exports; depends on `@lib/db-models` |
| `libs/identity/src/auth.ts` | `hooks: { before: createAuthMiddleware(refuseDeletedAccounts) }` |
| `libs/admin-contract/src/index.ts` | account `state` and `tracking` on `managedUserSchema`; `setUserTracking`, `deleteUser`, `restoreUser`, `nukeUser`, with their `.errors()` |
| `libs/admin-api/src/http/router.ts`, `src/users/service.ts`, `package.json`, `tsconfig.json` | the four handlers; `listUsers` reports each user's state and tracking, oldest first |
| `apps/admin-frontend/src/screens/users/UserRow.tsx`, `UsersTable.tsx`, `UsersScreen.tsx` | Status and Tracking columns, and Delete / Restore / Nuke per row |
| `apps/frontend/src/logic/analytics/client.ts`, `AnalyticsTracker.tsx` | `posthog-js` starts opted out; the tracker applies the visitor's setting |
| `apps/frontend/src/main.tsx`, `App.tsx` | the banner; `/privacy`, `/privacy/settings`, `/do-not-sell` |
| `apps/frontend/src/components/layouts/UnauthenticatedLayout.tsx`, `src/screens/home/HomeScreen.tsx` | `<PrivacyFooter />` at the bottom of every screen |
| `CLAUDE.md` | the policy-describes-the-app rule, erasing new personal data in `nukeUser`, and tracking consent belonging to analytics |
| `README.md`, `docs/architecture.md`, `docs/analytics.md` | `docs/privacy.md` in the index; deleted users and the admin API's new actions; consent |

### 2. Resolve conflicts

Resolve every conflict marker **by intent**: keep what the other side added for its own
feature, and add this capability's lines beside it. better-auth takes one `hooks.before`:
where the project already has one, make `await refuseDeletedAccounts(ctx)` its first line
rather than replacing either. Every `/sign-in/*` path must keep refusing a deleted account,
`nukeUser` must keep erasing everything that identifies the person, PostHog included, and
`posthog-js` must never capture before `applyTrackingSetting` opts it in. Tell the user which
files needed merging and why.

On a project that has edited its own docs, the doc patches are the likeliest to need the
intent fallback; their hunks are independent, so apply what lands and merge the rest.

### 3. Record the version

Add `"privacy": "<version from capability.json>"` to `capabilities` in `.edge-stack.json`.

### 4. Verify

```bash
pnpm install
pnpm type-check
pnpm lint
pnpm build
pnpm test
```

`tests/e2e/privacy/consent.spec.ts` covers each region's rules through the `geo_override`
cookie, the banner, the settings, Do Not Sell and the Worker's suppression, from the
browser's `[analytics]` lines and the Worker's log; `privacy-page.spec.ts` the page and its
links; `tests/e2e/admin/admin-lifecycle.spec.ts` deletes, restores and nukes users through
the admin API and UI and checks the sign-in refusal. No PostHog project is needed.

## The privacy policy (tell the user)

The text in `apps/frontend/src/screens/privacy/content.ts` is **kept minimal on purpose**: it
covers only what the stack itself does (account name and email, the sign-in cookie, request
logs at Cloudflare, and — with `analytics` — PostHog and the consent banner). It knows
nothing about the user's business, their country, or the data their own features collect,
so it is a placeholder to replace, not a policy to launch with. Say so plainly, and
recommend, in this order:

1. **Get a policy from a lawyer**, or have one review theirs — the requirements depend on
   where the business and its users are (GDPR, UK GDPR, CCPA/CPRA and other US state laws,
   …) and are not something to guess at.
2. **Or write their own** with a reputable generator or template, then fit it to the app.

Either way the text goes in `PRIVACY_SECTIONS` (one `{ title, body }` per section), and
`PRIVACY_POLICY_VERSION` changes whenever the policy changes in a way visitors should hear
about. If they want to write it themselves, offer to draft it with them, and make sure it
covers:

- **Who is responsible** — the legal entity, its address and the privacy contact (and an EU
  representative or a data protection officer where the law requires one).
- **What is collected** — every category of personal data, including what the app's own
  features add (profiles, uploads, payments, messages, support requests) and what is
  collected automatically (IP address, device and browser, logs).
- **Why, and on what legal basis** — each purpose (running the service, security,
  analytics, marketing emails) with its basis: contract, legitimate interest, consent or
  legal obligation.
- **Who it is shared with** — every processor (hosting and email at Cloudflare, analytics at
  PostHog, payment, support or email providers they add), whether anything is sold or
  shared for advertising, and what goes to authorities when compelled.
- **International transfers** — where the data is processed (these providers are in the
  United States) and the safeguards relied on.
- **How long it is kept** — a period or rule per category, including backups and analytics.
- **Cookies and device storage** — each cookie or `localStorage` key, what it is for, and
  how consent is asked for and withdrawn.
- **People's rights** — access, correction, deletion, restriction, portability, objection,
  withdrawing consent and complaining to a supervisory authority; for California, the
  rights to know, delete, correct and opt out of sale or sharing, and no discrimination for
  using them; and how to exercise them (the contact address, how identity is verified, the
  response time).
- **Children** — the minimum age, and what happens to data from a child.
- **Automated decisions or profiling**, if any.
- **Changes** — how updates are announced, and the date it takes effect.

## Setup (manual, tell the user)

- Fill the contact address if it was left as `REPLACE_WITH_PRIVACY_EMAIL`, and replace the
  minimal policy text before launch (**The privacy policy** above).
- The migrations run with every deploy, as the others do; nothing to apply by hand.
- **PostHog erasure on production.** Nuke erases the user's PostHog person through
  PostHog's private API, which needs a **personal API key** (PostHog → Settings → Personal
  API keys, scoped to the project with *Person: Write*) and the **project id** (Project
  settings). Set both as secrets of the Worker that serves the admin API (the admin Worker,
  where the project has one) on production:

  ```bash
  pnpm --filter @app/backend exec wrangler secret put POSTHOG_PERSONAL_API_KEY --name <worker>
  pnpm --filter @app/backend exec wrangler secret put POSTHOG_PROJECT_ID --name <worker>
  ```

  Until they are set, a nuke refuses with `503` and erases nothing wherever analytics may
  have been delivered — production, a preview run with **Deliver analytics**, and a
  deployed Worker that has no `ENVIRONMENT` of its own, such as an admin Worker. Local dev
  and e2e skip the PostHog step, since nothing was sent from there.
