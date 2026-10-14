import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { privacyPublicContract, type PrivacyPublicClient } from "@lib/contract";

// The procedures served without a session, outside the main contract's gate.
const api: PrivacyPublicClient = createORPCClient(
  new OpenAPILink(privacyPublicContract, {
    url: window.location.origin,
    fetch: (request, init) =>
      fetch(request, { ...init, credentials: "include" }),
  }),
);

export const publicOrpc = createTanstackQueryUtils(api, { path: ["public"] });
