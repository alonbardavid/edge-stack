import { oc, type ContractRouterClient } from "@orpc/contract";
import { z } from "zod";

export * from "./listing";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
});

export type User = z.infer<typeof userSchema>;

// Every procedure needs a signed-in user; the worker rejects the rest with 401.
export const contract = {
  me: oc.route({ method: "GET", path: "/api/me" }).output(userSchema),
};

export type Contract = typeof contract;

export type ApiClient = ContractRouterClient<Contract>;
