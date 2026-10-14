import { verifyPassword } from "better-auth/crypto";
import {
  getDb,
  eq,
  appAdmin,
  appAdminSession,
  newEntityId,
} from "@lib/db-models";
import type { AdminAccount } from "../types";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("admin-api/auth/sessions");

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function verifyAdminLogin(
  username: string,
  password: string,
): Promise<AdminAccount | null> {
  const rows = await getDb()
    .select()
    .from(appAdmin)
    .where(eq(appAdmin.username, username))
    .limit(1);
  const admin = rows[0];
  if (!admin) {
    log.warning("login failed: unknown username", { username });
    return null;
  }
  const valid = await verifyPassword({ hash: admin.password, password });
  if (!valid) {
    log.warning("login failed: bad password", { username });
    return null;
  }
  log.info("login succeeded", { username, adminId: admin.id });
  return { id: admin.id, username: admin.username };
}

export async function createAdminSession(
  adminId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(
    /-/g,
    "",
  );
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(appAdminSession)
    .values({ id: newEntityId("ADMIN_SESSION"), adminId, token, expiresAt });
  log.info("session created", { adminId });
  return { token, expiresAt };
}

export async function validateAdminSession(
  token: string,
): Promise<AdminAccount | null> {
  const rows = await getDb()
    .select({
      expiresAt: appAdminSession.expiresAt,
      adminId: appAdmin.id,
      username: appAdmin.username,
    })
    .from(appAdminSession)
    .innerJoin(appAdmin, eq(appAdminSession.adminId, appAdmin.id))
    .where(eq(appAdminSession.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    log.info("session expired", { adminId: row.adminId });
    await deleteAdminSession(token);
    return null;
  }
  return { id: row.adminId, username: row.username };
}

export async function deleteAdminSession(token: string): Promise<void> {
  await getDb().delete(appAdminSession).where(eq(appAdminSession.token, token));
}
