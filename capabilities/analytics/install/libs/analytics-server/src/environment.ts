import { env } from "cloudflare:workers";

type EnvironmentVars = { ENVIRONMENT?: string; ANALYTICS_ENABLED?: string };

/**
 * Production always reaches PostHog; anywhere else needs ANALYTICS_ENABLED,
 * which is how a branch preview is pointed at the real project. ENVIRONMENT is
 * a var, never the Host header, which the caller controls.
 */
export function analyticsDeliveryEnabled(): boolean {
  const { ENVIRONMENT, ANALYTICS_ENABLED } = env as unknown as EnvironmentVars;
  return ENVIRONMENT === "production" || ANALYTICS_ENABLED === "true";
}
