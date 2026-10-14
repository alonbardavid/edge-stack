import { oc, type ContractRouterClient } from "@orpc/contract";
import { z } from "zod";
import { listPageSchema, listQuerySchema } from "@lib/contract";

export const adminSchema = z.object({
  id: z.string(),
  username: z.string(),
});

export const managedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  createdAt: z.number(),
});

export type ManagedUser = z.infer<typeof managedUserSchema>;

export const userListQuerySchema = listQuerySchema(managedUserSchema, {
  sorts: ["name", "email", "createdAt"],
  filters: {},
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

const idSchema = z.object({ id: z.string() });
const okSchema = z.object({ ok: z.literal(true) });

export const adminContract = {
  me: oc
    .route({ method: "GET", path: "/api/admin/auth/me" })
    .output(adminSchema),
  listUsers: oc
    .route({ method: "GET", path: "/api/admin/users" })
    .input(userListQuerySchema)
    .output(listPageSchema(managedUserSchema)),
  createUser: oc
    .route({ method: "POST", path: "/api/admin/users" })
    .errors({
      BAD_REQUEST: {
        message: "Could not create user (email may already exist)",
      },
    })
    .input(
      z.object({
        email: z.email(),
        name: z.string().min(1),
        password: z.string().min(8),
      }),
    )
    .output(managedUserSchema),
  setUserPassword: oc
    .route({ method: "POST", path: "/api/admin/users/{id}/password" })
    .errors({ NOT_FOUND: { message: "User not found" } })
    .input(idSchema.extend({ newPassword: z.string().min(8) }))
    .output(okSchema),
};

export type AdminContract = typeof adminContract;

export type AdminApiClient = ContractRouterClient<AdminContract>;
