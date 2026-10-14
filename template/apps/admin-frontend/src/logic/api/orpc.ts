import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { adminContract, type AdminApiClient } from "@lib/admin-contract";

const api: AdminApiClient = createORPCClient(
  new OpenAPILink(adminContract, {
    url: window.location.origin,
    fetch: (request, init) =>
      fetch(request, { ...init, credentials: "include" }),
  }),
);

export const orpc = createTanstackQueryUtils(api, { path: ["admin"] });
