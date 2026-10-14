import { ORPCError } from "@orpc/client";

// A handler's own answer is shown as is; an unexpected failure says nothing
// useful to the user, so the caller's wording is used instead.
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR"
    ? error.message
    : fallback;
}
