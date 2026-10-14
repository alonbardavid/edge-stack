import { Hono } from "hono";
import { requireAdmin } from "./auth/middleware";
import { adminLogin, adminLogout } from "./auth/handlers";
import { adminApiHandler } from "./http/router";
import { serveAdminApp } from "./http/assets";
import type { AdminEnv } from "./types";

export const adminApp = new Hono<AdminEnv>();

adminApp.post("/api/admin/auth/login", adminLogin);
adminApp.use("/api/admin/*", requireAdmin());
adminApp.post("/api/admin/auth/logout", adminLogout);
adminApp.all("/api/admin/*", adminApiHandler);
adminApp.get("/admin", serveAdminApp);
adminApp.all("/admin/*", serveAdminApp);
