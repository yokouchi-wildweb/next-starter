// src/domains/core/userLineProfile/services/server/userLineProfileBase.ts

import { UserLineProfileTable } from "@/domains/core/userLineProfile/entities/drizzle";
import { createCrudService } from "@/lib/crud/server";

export const userLineProfileBase = createCrudService(UserLineProfileTable, {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
});
