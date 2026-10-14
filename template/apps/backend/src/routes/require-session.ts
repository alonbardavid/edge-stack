import { ORPCError, os } from "@orpc/server";
import type { RequestHeadersPluginContext } from "@orpc/server/plugins";
import { resolveRequestContext } from "@lib/identity";
import { moduleLogger, withContext } from "@lib/logging";

const log = moduleLogger("backend/routes/require-session");

export const requireSession = os
  .$context<RequestHeadersPluginContext>()
  .middleware(async ({ context, next }) => {
    const requestContext = await resolveRequestContext(
      context.reqHeaders ?? new Headers(),
    );
    if (!requestContext) {
      log.info("rejected an unauthenticated request");
      throw new ORPCError("UNAUTHORIZED", { message: "Not authenticated" });
    }
    // Must return the scope: LogTape context cannot be added to in place.
    return withContext({ userId: requestContext.user.id }, () =>
      next({ context: { requestContext } }),
    );
  });
