import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { PrivacyRegime, TrackingSetting } from "@lib/contract";
import { isProductionEnvironment } from "@lib/analytics-server";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("backend/privacy/region");

// The EU 27, where tracking is opt-in. Deliberately not the EEA, UK or CH.
const CONSENT_REQUIRED_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export const GEO_OVERRIDE_COOKIE = "geo_override";

export const DEFAULT_TRACKING_BY_REGIME: Record<
  PrivacyRegime,
  TrackingSetting
> = {
  DEFAULT: "enabled",
  EU: "server-only",
  CCPA: "enabled",
};

interface RequestLocation {
  country: string | null;
  regionCode: string | null;
}

/** Which privacy rules apply where this request came from. */
export function privacyRegime(c: Context): PrivacyRegime {
  const { country, regionCode } = statedLocation(c) ?? requestLocation(c);
  if (country && CONSENT_REQUIRED_COUNTRIES.has(country)) {
    return "EU";
  }
  if (country === "US" && regionCode === "CA") {
    return "CCPA";
  }
  return "DEFAULT";
}

/** Where Cloudflare's edge says the request came from; empty under vite dev. */
function requestLocation(c: Context): RequestLocation {
  const cf = c.req.raw.cf as
    | { country?: string; regionCode?: string }
    | undefined;
  return { country: cf?.country ?? null, regionCode: cf?.regionCode ?? null };
}

/**
 * Outside production a `geo_override` cookie (`DE`, `US-CA`) stands in for
 * the edge's geolocation, so another region's rules can be tried in dev, on a
 * preview and in e2e. Production ignores it: a visitor must not opt
 * themselves out of their own region's rules.
 */
function statedLocation(c: Context): RequestLocation | null {
  if (isProductionEnvironment()) {
    return null;
  }
  const [country, regionCode] = (getCookie(c, GEO_OVERRIDE_COOKIE) ?? "")
    .toUpperCase()
    .split("-");
  if (!country) {
    return null;
  }
  log.info("geography overridden by cookie", { country });
  return { country, regionCode: regionCode ?? null };
}
