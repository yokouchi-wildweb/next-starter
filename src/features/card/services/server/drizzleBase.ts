// src/features/card/services/server/drizzleBase.ts
import { CardTable } from "@/features/card/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(CardTable, {
  idType: "uuid",
  defaultOrderBy: [
    ["titleId", "ASC"],
    ["updatedAt", "DESC"],
  ],
});
