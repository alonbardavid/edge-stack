import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  verifyAdminLogin,
  createAdminSession,
  deleteAdminSession,
} from "./sessions";
import { ADMIN_SESSION_COOKIE } from "./cookie";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("admin-api/auth/handlers");

export async function adminLogin(c: Context) {
  const body = await c.req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    log.info("login rejected: missing username or password");
    return c.json({ message: "username and password are required" }, 400);
  }
  const admin = await verifyAdminLogin(username, password);
  if (!admin) {
    return c.json({ message: "Invalid username or password" }, 401);
  }
  const { token, expiresAt } = await createAdminSession(admin.id);
  setCookie(c, ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    path: "/",
    expires: expiresAt,
  });
  return c.json({ id: admin.id, username: admin.username });
}

export async function adminLogout(c: Context) {
  const token = getCookie(c, ADMIN_SESSION_COOKIE);
  if (token) {
    await deleteAdminSession(token);
  }
  deleteCookie(c, ADMIN_SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
}
