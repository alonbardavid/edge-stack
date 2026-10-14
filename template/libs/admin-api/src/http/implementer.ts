import { implement } from "@orpc/server";
import { adminContract } from "@lib/admin-contract";
import type { AdminAccount } from "../types";

export const admin = implement(adminContract).$context<{
  admin: AdminAccount;
}>();
