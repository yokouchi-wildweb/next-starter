// src/features/sampleCategory/services/server/drizzleBase.ts

import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import {
  SampleCategoryCreateSchema,
  SampleCategoryUpdateSchema,
} from "@/features/sampleCategory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const options = {
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
  ...options,
  schemas: {
    create: SampleCategoryCreateSchema,
    update: SampleCategoryUpdateSchema,
    upsert: SampleCategoryCreateSchema,
  },
});
