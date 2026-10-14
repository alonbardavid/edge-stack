# Capability: `analytics`

Product analytics in **PostHog**, through its own SDKs:

- `@lib/analytics-server` — a per-request scope over `posthog-node`: `analytics.capture(...)`
  anywhere in a Worker request buffers the event, and the batch leaves once through
  `waitUntil`. better-auth's own writes report `signed_up` and `signed_in`.
- `posthog-js` in the end-user SPA as `analytics` (ESLint keeps every other file off the raw
  SDK): page views, the signed-in user identified, `signed_out` with a reset. Autocapture and
  session recording are off, and every path and URL is reduced to its route pattern before it
  leaves the browser.
- One `ENVIRONMENT` value per deploy target. Only production delivers; staging, previews,
  local dev and e2e log every event instead, which the e2e spec reads. A preview can be run by
  hand with delivery on.
- Cloudflare Web Analytics is turned off for the production hostname, so pages carry one
  tracker, not two.

Needs a PostHog project (host + public project token), committed once in
`libs/contract/src/analytics.ts`. No secret and no repo variable. `posthog-js` adds about
105 kB gzip to the SPA, `posthog-node` about 65 kB gzip to the Worker.

`INSTALL.md` is the contract `add-edge-capability` executes: `install/` holds new files,
`install-patches/` one git patch per existing file it edits. The installed
`docs/analytics.md` is the project-side reference.
