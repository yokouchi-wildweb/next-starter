// src/features/sample/services/server/drizzleBase.ts

import { SampleTable } from "@/features/sample/entities/drizzle";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { OrderBySpec } from "@/lib/crud/types";

const baseOptions = {
  idType: "uuid" as const,
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "name",
    "description"
  ],
  defaultOrderBy: [["updatedAt", "DESC" as const]] as OrderBySpec
};

export const base = createCrudService(SampleTable, {
  ...baseOptions,
  parseCreate: (data) => SampleCreateSchema.parse(data),
  parseUpdate: (data) => SampleUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCreateSchema.parse(data),
});
