import posthog, { type CaptureResult } from "posthog-js";
import { POSTHOG_HOST, POSTHOG_PROJECT_TOKEN } from "@lib/contract";

posthog.init(POSTHOG_PROJECT_TOKEN, {
  api_host: POSTHOG_HOST,
  // Every event is one somebody chose to send. Autocapture would ship DOM text
  // and attributes nobody looked at, which is how a token leaves the browser.
  autocapture: false,
  disable_session_recording: true,
  capture_pageview: "history_change",
  capture_pageleave: true,
  person_profiles: "identified_only",
  // No feature flags and no extensions: two requests per page load saved.
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  // The SDK drops headless browsers as bots, which is every e2e run. Only a
  // build that delivers has anything to protect.
  opt_out_useragent_filter: !__ANALYTICS_DELIVER__,
  sanitize_properties: maskIdentifiers,
  before_send: __ANALYTICS_DELIVER__ ? undefined : logInstead,
});

posthog.register({ app_side: "browser" });

export { posthog as analytics };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Long enough to be opaque and carrying a digit. Name static route segments
// with words only, or they are masked too.
const OPAQUE = /^(?=.*\d)[A-Za-z0-9_-]{12,}$/;

/** Ids and tokens in a path never leave the browser: `/items/:id`. */
export function maskPath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      UUID.test(segment) || OPAQUE.test(segment) ? ":id" : segment,
    )
    .join("/");
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${maskPath(parsed.pathname)}`;
  } catch {
    return maskPath(url.split("?")[0] ?? "");
  }
}

/**
 * Masks by key shape, not by a list: the SDK carries the path under several
 * keys ($pathname, $session_entry_url, $prev_pageview_pathname, …) and adds
 * more between versions. Query strings are dropped with the URL.
 */
function maskIdentifiers(properties: Record<string, unknown>) {
  const masked: Record<string, unknown> = { ...properties };
  for (const [key, value] of Object.entries(masked)) {
    if (typeof value !== "string") {
      continue;
    }
    if (key.endsWith("pathname")) {
      masked[key] = maskPath(value);
    } else if (key.endsWith("url") || key.endsWith("referrer")) {
      masked[key] = maskUrl(value);
    }
  }
  return masked;
}

// console.info, not debug: Chrome hides debug by default, and the e2e specs
// read these lines.
function logInstead(event: CaptureResult | null) {
  if (event) {
    console.info(
      "[analytics]",
      event.event,
      JSON.stringify({
        distinct_id: event.properties.distinct_id,
        properties: event.properties,
      }),
    );
  }
  return null;
}
