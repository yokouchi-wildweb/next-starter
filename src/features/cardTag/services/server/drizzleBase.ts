// src/features/cardTag/services/server/drizzleBase.ts
import { CardTagTable } from "@/features/cardTag/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(CardTagTable, {
  idType: "uuid",
  defaultOrderBy: [["updatedAt", "DESC"]],
});
