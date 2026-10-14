import { oc, type ContractRouterClient } from "@orpc/contract";
import { z } from "zod";

// Which privacy rules apply where a request came from. EU means tracking is
// opt-in behind the banner; CCPA means the Do Not Sell opt-out applies.
export const PRIVACY_REGIMES = ["DEFAULT", "EU", "CCPA"] as const;

export const privacyRegimeSchema = z.enum(PRIVACY_REGIMES);

export type PrivacyRegime = z.infer<typeof privacyRegimeSchema>;

// What is tracked, least to most restrictive. `server-only` keeps the browser
// silent and storing nothing while the Worker still records state changes;
// `disabled` (the Do Not Sell opt-out) stops both.
export const TRACKING_SETTINGS = [
  "enabled",
  "server-only",
  "disabled",
] as const;

export const trackingSettingSchema = z.enum(TRACKING_SETTINGS);

export type TrackingSetting = z.infer<typeof trackingSettingSchema>;

export const privacyConfigSchema = z.object({
  regime: privacyRegimeSchema,
  // What applies while nothing has been decided.
  defaultTracking: trackingSettingSchema,
  // The decision recorded against the signed-in account; null when nobody is
  // signed in or nothing has been recorded yet.
  tracking: trackingSettingSchema.nullable(),
});

export type PrivacyConfig = z.infer<typeof privacyConfigSchema>;

export const setTrackingSettingSchema = z.object({
  tracking: trackingSettingSchema,
});

export type SetTrackingSettingBody = z.infer<typeof setTrackingSettingSchema>;

// Answered with or without a session: the visitor who is not signed in is the
// one the banner is for, so this is served outside the session gate.
export const privacyPublicContract = {
  getPrivacyConfig: oc
    .route({ method: "GET", path: "/api/public/privacy-config" })
    .output(privacyConfigSchema),
};

export type PrivacyPublicClient = ContractRouterClient<
  typeof privacyPublicContract
>;

export const privacyRoutes = {
  setTrackingSetting: oc
    .route({ method: "PUT", path: "/api/privacy/tracking" })
    .input(setTrackingSettingSchema)
    .output(z.object({ ok: z.literal(true) })),
};
