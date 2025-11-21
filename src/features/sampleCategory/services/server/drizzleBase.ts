// src/features/sampleCategory/services/server/drizzleBase.ts

import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleCategoryCreateSchema, SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const baseOptions = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "name",
    "description"
  ],
  defaultOrderBy: [
    [
      "updatedAt",
      "DESC"
    ]
  ]
};

export const base = createCrudService(SampleCategoryTable, {
  ...baseOptions,
  parseCreate: (data) => SampleCategoryCreateSchema.parse(data),
  parseUpdate: (data) => SampleCategoryUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCategoryCreateSchema.parse(data),
});
