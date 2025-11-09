// src/features/series/services/server/drizzleBase.ts
import { SeriesTable } from "@/features/series/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(SeriesTable, {
  idType: "uuid",
  defaultOrderBy: [
    ["titleId", "ASC"],
    ["updatedAt", "DESC"],
  ],
});
