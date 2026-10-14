import type { Context } from "hono";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError, ORPCError } from "@orpc/server";
import { createUser, listUsers, setUserPassword } from "../users/service";
import type { AdminEnv } from "../types";
import { admin } from "./implementer";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("admin-api/http/router");

export async function adminApiHandler(c: Context<AdminEnv>): Promise<Response> {
  const { matched, response } = await handler.handle(c.req.raw, {
    context: { admin: c.get("admin") },
  });
  return matched ? c.newResponse(response.body, response) : c.notFound();
}

const adminRouter = admin.router({
  me: admin.me.handler(({ context }) => ({
    id: context.admin.id,
    username: context.admin.username,
  })),
  listUsers: admin.listUsers.handler(({ input }) => listUsers(input)),
  createUser: admin.createUser.handler(async ({ input, errors }) => {
    try {
      return await createUser(input);
    } catch (error) {
      log.warning("user creation failed", { err: error });
      throw errors.BAD_REQUEST({ cause: error });
    }
  }),
  setUserPassword: admin.setUserPassword.handler(async ({ input, errors }) => {
    const updated = await setUserPassword(input.id, input.newPassword);
    if (!updated) {
      throw errors.NOT_FOUND();
    }
    return { ok: true as const };
  }),
});

const handler = new OpenAPIHandler(adminRouter, {
  interceptors: [onError(logUnexpectedError)],
});

// An ORPCError is an answer the handler meant to give; anything else is a bug.
function logUnexpectedError(error: unknown): void {
  if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR") {
    return;
  }
  log.error("admin request handler threw", { err: error });
}
