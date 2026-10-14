# Capability: `privacy`

Privacy for a project that tracks with **`analytics`**, which it requires:

- **Tracking consent.** `GET /api/public/privacy-config` gives the visitor's regime from
  Cloudflare's geolocation (`EU`, `CCPA` for California, `DEFAULT`), its default, and the
  account's own setting; a `geo_override` cookie stands in for the location outside
  production. `posthog-js` starts opted out and storing nothing. EU visitors get an opt-in
  banner, whose answer stays on the device until they sign in; Californians get a Do Not
  Sell page; a Global Privacy Control signal is honoured.
- **A tracking setting per account** in `tracking_settings` (`enabled` / `server-only` /
  `disabled`), set from `/privacy/settings` or by an admin; the Worker drops every event of
  a `disabled` user.
- **`/privacy`** — a static policy page, reachable signed in or out, linked from a footer on
  every screen. Its text, kept in one `content.ts`, is minimal on purpose: a placeholder
  covering only what the stack does, to replace with the project's own policy (ideally
  from a lawyer) before launch.
- **Account lifecycle** in the admin app's users table: **delete** (locks the user out and
  ends every session), **restore**, and **nuke** — the erasure request: the PostHog person
  and events erased, name and email scrambled, credentials, sessions and verifications
  deleted, never undone. The row stays as "Deleted user", so nothing that points at it
  breaks. better-auth refuses a deleted account's sign-in through a `before` hook.

No new GitHub secret or variable. Two migrations (`user.nuked_at`, `tracking_settings`);
production needs two Worker secrets for the PostHog erasure.

`INSTALL.md` is the contract `add-edge-capability` executes: `install/` holds new files,
`install-patches/` one git patch per existing file it edits, cut against the template with
`analytics` installed. The installed `docs/privacy.md` is the project-side reference.
