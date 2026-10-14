# Analytics

Product analytics go to **PostHog** through its own SDKs: `posthog-js` in the end-user SPA
and `posthog-node` in the Worker (its `workerd` export condition picks the edge build). The
admin app sends nothing. The project's host and public token live once, in
`libs/contract/src/analytics.ts`; a project token can only write events and ships in every
browser bundle, so it is committed, not a secret.

## Who emits what

**One emitter per fact.** The Worker reports state changes, from the code that makes them;
the browser reports intent and navigation. Nothing is counted twice, and no tracking lives in
a frontend mutation hook — the server already reports the change.

| Event                     | Side    | Where                                                                  |
| ------------------------- | ------- | ---------------------------------------------------------------------- |
| `$pageview`, `$pageleave` | browser | the SDK, on every route change                                         |
| `$identify` (email, name) | browser | `AnalyticsTracker`, while someone is signed in                         |
| `signed_out`              | browser | `useLogout`, which then resets the SDK's id                            |
| `signed_up` (+ identify)  | Worker  | better-auth's user-create hook, `libs/identity/src/analytics-hooks.ts` |
| `signed_in`               | Worker  | better-auth's session-create hook, same file                           |

Browser events carry `app_side: "browser"`, Worker events `app_side: "server"`; both use the
user id as the distinct id once someone is signed in.

To add an event: in the Worker, `analytics.capture({ distinctId, event, properties })` from
`@lib/analytics-server`, right after the change commits; in the SPA, `analytics.capture(...)`
from `apps/frontend/src/logic/analytics/client.ts` (ESLint rejects importing `posthog-js`
anywhere else). Name events `snake_case`, past tense for facts (`invite_accepted`), and keep
properties to flags, counts and route patterns.

## The Worker's request scope

`@lib/analytics-server` is a scope, not a client. `analyticsMiddleware` wraps every `/api/*`
request in `withAnalytics`, an AsyncLocalStorage scope, so `analytics.capture(...)` anywhere
in the request only buffers the event; the batch leaves once, through `waitUntil`, after the
response. A PostHog client is built per batch, since a Worker may not carry one across
requests. An event emitted outside a request (a cron handler) needs its own
`withAnalytics(...)`, or it is dropped with a warning.

## Ids never leave the browser

`sanitize_properties` masks by key **shape**: anything ending in `pathname` is reduced to its
route pattern, anything ending in `url` or `referrer` to origin plus pattern with the query
dropped — which covers the keys the SDK adds on its own (`$session_entry_url`,
`$prev_pageview_pathname`, …). A path segment becomes `:id` when it is a uuid, or 12+
characters with a digit, so name static route segments with words only. Autocapture and
session recording are off: every event is one somebody chose to send.

## Delivery per environment

Only production delivers. Staging, previews, local dev and e2e log every event instead:
the browser as `[analytics] <event> {"distinct_id":…,"properties":…}` on the console, the
Worker as an `analytics event` log line (identify traits by name only). The e2e specs in
`tests/e2e/analytics/` read both.

Both sides learn where they run from one `ENVIRONMENT` value — `production`, `staging` or
`development`; a preview is `staging`, so a preview version promoted onto staging stays
truthful; unset means `development`, which is local dev and e2e. The Worker reads it as a
var the config generator stamps per target, never from the request host. The SPA bakes it
in at build time through a vite `define`, which is why every deploy workflow sets it on its
build step and `turbo.json` declares it (and `ANALYTICS_ENABLED`) on the build task.

`ANALYTICS_ENABLED=true` turns delivery on anywhere else. To check that a tracking change
really lands in PostHog, run **Preview Version Upload** by hand from the Actions tab on the
branch with **Deliver analytics** ticked — the next push uploads a logging preview again.

[← back to the README](../README.md)
