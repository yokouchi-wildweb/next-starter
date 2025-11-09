// src/features/title/services/server/drizzleBase.ts
import { TitleTable } from "@/features/title/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

export const base = createCrudService(TitleTable, {
  idType: "uuid",
  defaultOrderBy: [["updatedAt", "DESC"]],
});
