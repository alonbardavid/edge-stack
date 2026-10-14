# Privacy

## The policy

`/privacy` is a static page, reachable signed in or out, rendered from
`apps/frontend/src/screens/privacy/content.ts`: the sections, the contact address and
`PRIVACY_POLICY_VERSION`, the date shown as "Last updated". It must describe what the app
really collects, stores on the device and shares: a change that adds any of those updates
the text in the same PR, and bumps the version when visitors should hear about it — which
also asks everyone behind the consent banner again.
`PrivacyFooter` links it from every signed-out screen and the home screen, and hides the
link on the page itself.

## Deleting and erasing an account

An account is **active**, **deleted** or **nuked** (`user.deleted_at`, `user.nuked_at`). The
admin app's users table moves it between them, through `libs/admin-api/src/users/lifecycle.ts`:

| Action  | From    | What happens                                                     |
| ------- | ------- | ---------------------------------------------------------------- |
| Delete  | active  | `deleted_at` set, sessions deleted; sign-in refused from then on |
| Restore | deleted | `deleted_at` cleared; the user can sign in again                 |
| Nuke    | deleted | personal data scrambled, credentials deleted; never undone       |

Nuke renames the user "Deleted user", sets the email to `deleted-<id>@deleted.invalid`,
clears the image, deletes the credential, sessions and verifications, and sets
`nuked_at`.

The row itself always stays, so anything that points at the user keeps resolving. Sign-in
refuses a deleted account in `libs/identity/src/deleted-accounts.ts`, a better-auth `before`
hook on every `/sign-in/*` path (`403 ACCOUNT_DELETED`); better-auth does not read
`deleted_at` itself.

Nuke erases the user's PostHog person and events first, so a failure there leaves the user
merely deleted and the nuke can be retried. It needs the `POSTHOG_PROJECT_ID` and
`POSTHOG_PERSONAL_API_KEY` secrets on the Worker serving the admin API. Without them it
skips the step only where nothing can have been sent (local dev, e2e, a Worker whose
`ENVIRONMENT` says it does not deliver) and refuses with `503` anywhere else, rather than
claim an erasure it did not do.

Nuke is the erasure request ("right to be forgotten"). Any new table holding personal data
about a user — an address, a profile, a copy of their email — is erased or scrambled in
`nukeUser` too, and anything showing one user to another treats a deleted user's name as
"Deleted user".

## Tracking consent

What a person agreed to is one of three `TRACKING_SETTINGS`
(`libs/contract/src/privacy-schemas.ts`), least to most restrictive:

| Setting       | Browser (`posthog-js`)              | Worker (`@lib/analytics-server`) |
| ------------- | ----------------------------------- | -------------------------------- |
| `enabled`     | captures, keeps an id on the device | sends                            |
| `server-only` | silent, stores nothing              | sends                            |
| `disabled`    | silent, stores nothing              | drops every event                |

**Which rules apply** comes from `GET /api/public/privacy-config`, answered signed in or
out: the regime (`apps/backend/src/privacy/region.ts` reads Cloudflare's geolocation — `EU`
for the EU 27, `CCPA` for California, else `DEFAULT`), that regime's default (`EU` →
`server-only`, else `enabled`) and the signed-in account's own setting. Outside production
a `geo_override` cookie (`DE`, `US-CA`) stands in for the geolocation, which is how dev,
previews and e2e try another region's rules.

**The browser** starts opted out and storing nothing; `applyTrackingSetting` in
`logic/analytics/client.ts` opts it in only for `enabled`. `logic/privacy/` works out the
setting that applies, worst wins: the account's decision, else this device's banner answer
(EU only, kept in `localStorage` against `PRIVACY_POLICY_VERSION`), else the regime's
default — and a Global Privacy Control signal is a floor (`server-only`, `disabled` in
California). An EU visitor with no decision sees `ConsentBanner`. A decision made on the
device before signing in follows the account once there is one; a Californian's GPC signal
is recorded as their opt-out.

**Registered users' decisions** live in `tracking_settings` (one row per user, with who last
changed it: the user or an admin). `/privacy/settings` holds the browser-tracking switch;
Californians also get `/do-not-sell`, whose switch is `disabled` and holds the other off.
Admins set anyone's tracking from the users table. **The Worker** filters every batch
through `loadSuppressedUserIds`, so a `disabled` user's events are dropped whoever raised
them; a failed lookup drops the whole batch.

[← back to the README](../README.md)
