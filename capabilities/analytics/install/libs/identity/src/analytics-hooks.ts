import type { BetterAuthOptions } from "better-auth";
import { analytics } from "@lib/analytics-server";

/**
 * better-auth's own writes are the facts: a user row is a sign-up and a
 * session row is a sign-in, whichever endpoint created it.
 */
export const analyticsHooks: BetterAuthOptions["databaseHooks"] = {
  user: {
    create: {
      after: async (user) => {
        analytics.identify({
          distinctId: user.id,
          properties: { email: user.email, name: user.name },
        });
        analytics.capture({
          distinctId: user.id,
          event: "signed_up",
          properties: { email_verified: user.emailVerified },
        });
      },
    },
  },
  session: {
    create: {
      after: async (session, ctx) => {
        analytics.capture({
          distinctId: session.userId,
          event: "signed_in",
          properties: { auth_path: ctx?.path ?? null },
        });
      },
    },
  },
};
