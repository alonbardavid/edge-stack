import { Hono } from "hono";
import { adminApp } from "@lib/admin-api";
import { errorHandler, httpLogger } from "@lib/server-commons";

const app = new Hono();

app.onError(errorHandler);

// First, so every line written while serving a request carries its context.
app.use("*", httpLogger);

app.get("/", (c) => c.redirect("/admin/"));

app.route("/", adminApp);

export default app;
