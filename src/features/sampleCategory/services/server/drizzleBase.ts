// src/features/sampleCategory/services/server/drizzleBase.ts

import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleCategoryCreateSchema, SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import { createCrudService, type DefaultInsert } from "@/lib/crud/drizzle";
import type { CreateCrudServiceOptions } from "@/lib/crud/types";

const baseOptions: CreateCrudServiceOptions<DefaultInsert<typeof SampleCategoryTable>> = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "name",
    "description"
  ],
  defaultOrderBy: [["updatedAt", "DESC" as const]],
};

export const base = createCrudService(SampleCategoryTable, {
  ...baseOptions,
  parseCreate: (data) => SampleCategoryCreateSchema.parse(data),
  parseUpdate: (data) => SampleCategoryUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCategoryCreateSchema.parse(data),
});
