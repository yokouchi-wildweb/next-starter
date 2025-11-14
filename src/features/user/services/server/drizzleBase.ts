// src/features/user/services/server/drizzleBase.ts
import { UserTable } from "@/features/user/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(UserTable, {
  idType: "uuid",
  defaultOrderBy: [["updatedAt", "DESC"]],
  defaultSearchFields: ["displayName", "email"],
});
