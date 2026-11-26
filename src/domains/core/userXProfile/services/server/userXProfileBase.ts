// src/domains/core/userXProfile/services/server/userXProfileBase.ts

import { UserXProfileTable } from "@/domains/core/userXProfile/entities/drizzle";
import { createCrudService } from "@/lib/crud/server";

export const userXProfileBase = createCrudService(UserXProfileTable, {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
});
