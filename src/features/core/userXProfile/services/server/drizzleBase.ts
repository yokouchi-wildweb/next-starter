// src/features/userXProfile/services/server/drizzleBase.ts

import { UserXProfileTable } from "@/features/core/userXProfile/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(UserXProfileTable, {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
});
