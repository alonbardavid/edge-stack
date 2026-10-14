import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { validateAdminSession } from "./sessions";
import { ADMIN_SESSION_COOKIE } from "./cookie";
import type { AdminEnv } from "../types";
import { moduleLogger, withContext } from "@lib/logging";

const log = moduleLogger("admin-api/auth/middleware");

export function requireAdmin(): MiddlewareHandler<AdminEnv> {
  return async (c, next) => {
    const token = getCookie(c, ADMIN_SESSION_COOKIE);
    const admin = token ? await validateAdminSession(token) : null;
    if (!admin) {
      log.info("rejected an unauthenticated admin request");
      return c.json({ message: "Not authenticated" }, 401);
    }
    c.set("admin", admin);
    return withContext(
      { adminId: admin.id, adminUsername: admin.username },
      next,
    );
  };
}
