import type { Context } from "hono";
import type { PrivacyConfig } from "@lib/contract";
import { getAuth } from "@lib/identity";
import { loadTrackingSetting, setTrackingSetting } from "@lib/analytics-server";
import { moduleLogger } from "@lib/logging";
import { DEFAULT_TRACKING_BY_REGIME, privacyRegime } from "../privacy/region";
import { api } from "./api";

const log = moduleLogger("backend/routes/privacy");

/**
 * Served signed in or out, ahead of the session gate, and from Hono rather
 * than the oRPC handler: the regime needs the request's `cf` geolocation.
 */
export async function privacyConfigHandler(c: Context): Promise<Response> {
  return c.json(await buildPrivacyConfig(c));
}

export const setTracking = api.setTrackingSetting.handler(
  async ({ input, context }) => {
    const userId = context.requestContext.user.id;
    await setTrackingSetting({
      userId,
      tracking: input.tracking,
      updatedBy: userId,
    });
    return { ok: true as const };
  },
);

async function buildPrivacyConfig(c: Context): Promise<PrivacyConfig> {
  const regime = privacyRegime(c);
  const session = await getAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  const userId = session?.user.id ?? null;
  const tracking = userId ? await loadTrackingSetting(userId) : null;
  log.info("privacy config resolved", { userId, regime, tracking });
  return {
    regime,
    defaultTracking: DEFAULT_TRACKING_BY_REGIME[regime],
    tracking,
  };
}
