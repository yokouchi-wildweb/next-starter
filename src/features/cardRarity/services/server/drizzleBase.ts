// src/features/cardRarity/services/server/drizzleBase.ts
import { CardRarityTable } from "@/features/cardRarity/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(CardRarityTable, {
  idType: "uuid",
  defaultOrderBy: [
    ["titleId", "ASC"],
    ["sortOrder", "ASC"],
    ["updatedAt", "DESC"],
  ],
});
