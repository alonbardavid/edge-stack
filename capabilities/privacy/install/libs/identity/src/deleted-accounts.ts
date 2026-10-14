import { APIError } from "better-auth/api";
import { getDb, user, sql } from "@lib/db-models";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("identity/deleted-accounts");

const SIGN_IN_PATH_PREFIX = "/sign-in/";

export const ACCOUNT_DELETED_MESSAGE = "This account has been deleted.";

/**
 * A better-auth `before` hook. A deleted account keeps its row and, until it
 * is nuked, its credential, so every sign-in checks for it: deleting a user is
 * what locks them out.
 */
export async function refuseDeletedAccounts(ctx: {
  path: string;
  body?: { email?: unknown };
}): Promise<void> {
  const email = ctx.body?.email;
  if (!ctx.path.startsWith(SIGN_IN_PATH_PREFIX) || typeof email !== "string") {
    return;
  }
  const rows = await getDb()
    .select({ id: user.id, deletedAt: user.deletedAt })
    .from(user)
    .where(sql`lower(${user.email}) = ${email.toLowerCase()}`)
    .limit(1);
  const account = rows[0];
  if (account?.deletedAt) {
    log.warning("refused sign-in for a deleted user", { userId: account.id });
    throw new APIError("FORBIDDEN", {
      code: "ACCOUNT_DELETED",
      message: ACCOUNT_DELETED_MESSAGE,
    });
  }
}
