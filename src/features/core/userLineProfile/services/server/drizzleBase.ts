// src/features/userLineProfile/services/server/drizzleBase.ts

import { UserLineProfileTable } from "@/features/core/userLineProfile/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(UserLineProfileTable, {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
});
