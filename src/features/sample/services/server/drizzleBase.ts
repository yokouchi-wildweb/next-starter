// src/features/sample/services/server/drizzleBase.ts

import { SampleTable } from "@/features/sample/entities/drizzle";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
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

export const base = createCrudService(SampleTable, {
  ...options,
  schemas: {
    create: SampleCreateSchema,
    update: SampleUpdateSchema,
    upsert: SampleCreateSchema,
  },
});
