import { Hono } from "hono";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError, onError } from "@orpc/server";
import { RequestHeadersPlugin } from "@orpc/server/plugins";
import { adminApp } from "@lib/admin-api";
import { errorHandler, httpLogger } from "@lib/server-commons";
import { moduleLogger } from "@lib/logging";
import { getAuth } from "@lib/identity";
import { api } from "./routes/api";
import { health } from "./routes/health";
import { me } from "./routes/me";

const log = moduleLogger("backend/index");

const apiHandler = new OpenAPIHandler(api.router({ me }), {
  plugins: [new RequestHeadersPlugin()],
  interceptors: [onError(logUnexpectedError)],
});

const app = new Hono();

app.onError(errorHandler);

// First, so every line written while serving a request carries its context.
app.use("*", httpLogger);

app.on(["POST", "GET"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));

app.get("/api/health", health);

app.route("/", adminApp);

app.use("/api/*", async (c, next) => {
  const { matched, response } = await apiHandler.handle(c.req.raw, {
    context: {},
  });
  return matched ? c.newResponse(response.body, response) : next();
});

export default app;

// An ORPCError is an answer the handler meant to give; anything else is a bug.
function logUnexpectedError(error: unknown): void {
  if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR") {
    return;
  }
  log.error("request handler threw", { err: error });
}
