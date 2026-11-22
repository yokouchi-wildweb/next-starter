// src/domains/userXProfile/services/server/drizzleBase.ts

import { UserXProfileTable } from "@/domains/core/userXProfile/entities/drizzle";
import { createCrudService } from "@/lib/crud/server";

export const base = createCrudService(UserXProfileTable, {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
});
