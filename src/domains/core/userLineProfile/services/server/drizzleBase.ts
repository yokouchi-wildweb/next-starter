// src/domains/userLineProfile/services/server/drizzleBase.ts

import { UserLineProfileTable } from "@/domains/core/userLineProfile/entities/drizzle";
import { createCrudService } from "@/lib/crud/server";

export const base = createCrudService(UserLineProfileTable, {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
});
