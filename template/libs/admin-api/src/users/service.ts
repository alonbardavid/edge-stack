import { hashPassword } from "better-auth/crypto";
import {
  getDb,
  paginate,
  matchesAllTerms,
  user,
  userAccounts,
  and,
  eq,
  sql,
  newEntityId,
  type ListResult,
} from "@lib/db-models";
import { moduleLogger } from "@lib/logging";
import type { UserListQuery } from "@lib/admin-contract";

const log = moduleLogger("admin-api/users/service");

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: number;
}

export async function listUsers(
  query: UserListQuery,
): Promise<ListResult<ManagedUser>> {
  const page = await paginate(
    getDb()
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      })
      .from(user)
      .$dynamic(),
    query,
    {
      defaultSort: "name",
      filters: {
        q: (q) =>
          matchesAllTerms(
            sql`${user.name} || ' ' || ${user.email}`,
            q.split(/\s+/),
          ),
      },
    },
  );
  log.debug("listed users", {
    searched: Boolean(query.q),
    returned: page.items.length,
  });
  return { ...page, items: page.items.map(toManagedUser) };
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<ManagedUser> {
  const userId = newEntityId("USER");
  const hash = await hashPassword(input.password);
  await getDb().insert(user).values({
    id: userId,
    name: input.name,
    email: input.email,
    emailVerified: true,
  });
  await getDb()
    .insert(userAccounts)
    .values({
      id: newEntityId("USER_ACCOUNT"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
    });
  log.info("user created", { userId });
  return {
    id: userId,
    name: input.name,
    email: input.email,
    emailVerified: true,
    createdAt: Date.now(),
  };
}

export async function setUserPassword(
  userId: string,
  newPassword: string,
): Promise<boolean> {
  const exists = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!exists[0]) {
    log.warning("set password for a missing user", { userId });
    return false;
  }
  await getDb()
    .update(userAccounts)
    .set({ password: await hashPassword(newPassword), updatedAt: new Date() })
    .where(
      and(
        eq(userAccounts.userId, userId),
        eq(userAccounts.providerId, "credential"),
      ),
    );
  log.info("password updated", { userId });
  return true;
}

function toManagedUser(row: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
}): ManagedUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt.getTime(),
  };
}
