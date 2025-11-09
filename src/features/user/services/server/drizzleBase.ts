// src/features/user/services/server/drizzleBase.ts
import { UserTable } from "@/features/user/entities/drizzle";
import { AdminUserOpotionalSchema, AdminUserSchema } from "@/features/user/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const options = {
  idType: "uuid",
  defaultOrderBy: [["updatedAt", "DESC"]],
  defaultSearchFields: ["displayName", "email"],
} as const;

export const base = createCrudService(UserTable, {
  ...options,
  schemas: {
    create: AdminUserSchema,
    update: AdminUserOpotionalSchema,
    upsert: AdminUserSchema,
  },
});
