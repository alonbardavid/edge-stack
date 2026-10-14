import { env } from "cloudflare:workers";
import type { MiddlewareHandler } from "hono";
import { withDb } from "@lib/db-models";

export const dbMiddleware: MiddlewareHandler = (c, next) =>
  withDb(env, next, (work) => c.executionCtx.waitUntil(work));
