import type { MiddlewareHandler } from "hono";
import { analyticsDeliveryEnabled } from "./environment";
import { withAnalytics } from "./scope";

/** Collects a request's events and sends them as one batch once it is done. */
export const analyticsMiddleware: MiddlewareHandler = (c, next) =>
  withAnalytics({ deliver: analyticsDeliveryEnabled() }, next, (work) =>
    c.executionCtx.waitUntil(work),
  );
