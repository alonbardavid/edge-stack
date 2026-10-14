import {
  getDb,
  user,
  userAccounts,
  userSessions,
  userVerifications,
  eq,
  or,
} from "@lib/db-models";
import {
  erasePerson,
  PersonErasureNotConfiguredError,
  setTrackingSetting,
} from "@lib/analytics-server";
import type { TrackingSetting } from "@lib/admin-contract";
import type { AdminAccount } from "../types";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("admin-api/users/lifecycle");

export const DELETED_USER_NAME = "Deleted user";

export class UserLifecycleError extends Error {
  constructor(
    public readonly code: "BAD_REQUEST" | "NOT_FOUND" | "SERVICE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Locks the account out and signs it out everywhere. The row stays, so
 * anything that points at the user still resolves; sign-in refuses it.
 */
export async function deleteUser(
  userId: string,
  admin: AdminAccount,
): Promise<void> {
  const account = await requireAccount(userId);
  if (account.deletedAt) {
    throw new UserLifecycleError("BAD_REQUEST", "This user is already deleted");
  }
  await getDb().batch([
    getDb()
      .update(user)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, userId)),
    getDb().delete(userSessions).where(eq(userSessions.userId, userId)),
  ]);
  log.info("admin deleted a user", { adminId: admin.id, userId });
}

export async function restoreUser(
  userId: string,
  admin: AdminAccount,
): Promise<void> {
  const account = await requireAccount(userId);
  if (account.nukedAt) {
    throw new UserLifecycleError(
      "BAD_REQUEST",
      "A nuked user cannot be restored",
    );
  }
  if (!account.deletedAt) {
    throw new UserLifecycleError("BAD_REQUEST", "This user is not deleted");
  }
  await getDb()
    .update(user)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(user.id, userId));
  log.info("admin restored a user", { adminId: admin.id, userId });
}

/**
 * The right to be forgotten: everything that identifies the person is erased
 * or scrambled, while the row stays as "Deleted user" so nothing that points
 * at it breaks. The credential goes too, so nothing signs in as it again. The
 * analytics profile goes first, so a failure there leaves the user merely
 * deleted and the nuke can be retried.
 */
export async function nukeUser(
  userId: string,
  admin: AdminAccount,
): Promise<void> {
  const account = await requireAccount(userId);
  if (account.nukedAt) {
    throw new UserLifecycleError("BAD_REQUEST", "This user is already nuked");
  }
  if (!account.deletedAt) {
    throw new UserLifecycleError(
      "BAD_REQUEST",
      "Delete the user before nuking them",
    );
  }
  await eraseAnalyticsProfile(userId);
  await getDb().batch([
    getDb()
      .update(user)
      .set({
        name: DELETED_USER_NAME,
        email: `deleted-${userId}@deleted.invalid`,
        image: null,
        nukedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId)),
    getDb().delete(userAccounts).where(eq(userAccounts.userId, userId)),
    getDb().delete(userSessions).where(eq(userSessions.userId, userId)),
    getDb()
      .delete(userVerifications)
      .where(
        or(
          eq(userVerifications.identifier, account.email),
          eq(userVerifications.value, userId),
        ),
      ),
  ]);
  log.info("admin nuked a user", { adminId: admin.id, userId });
}

export async function setUserTracking(
  userId: string,
  tracking: TrackingSetting,
  admin: AdminAccount,
): Promise<void> {
  await requireAccount(userId);
  await setTrackingSetting({ userId, tracking, updatedBy: admin.id });
}

async function eraseAnalyticsProfile(userId: string): Promise<void> {
  try {
    await erasePerson(userId);
  } catch (error) {
    if (error instanceof PersonErasureNotConfiguredError) {
      throw new UserLifecycleError("SERVICE_UNAVAILABLE", error.message);
    }
    throw error;
  }
}

async function requireAccount(userId: string) {
  const rows = await getDb()
    .select({
      email: user.email,
      deletedAt: user.deletedAt,
      nukedAt: user.nukedAt,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const account = rows[0];
  if (!account) {
    log.warning("lifecycle action on a missing user", { userId });
    throw new UserLifecycleError("NOT_FOUND", "User not found");
  }
  return account;
}
