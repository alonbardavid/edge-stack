import { implement } from "@orpc/server";
import type { RequestHeadersPluginContext } from "@orpc/server/plugins";
import { contract } from "@lib/contract";
import { requireSession } from "./require-session";

export const api = implement(contract)
  .$context<RequestHeadersPluginContext>()
  .use(requireSession);
