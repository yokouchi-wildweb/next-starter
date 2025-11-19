// src/features/sample/services/server/drizzleBase.ts

import { SampleTable } from "@/features/sample/entities/drizzle";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
import { createCrudService, type DefaultInsert } from "@/lib/crud/drizzle";
import type { CreateCrudServiceOptions } from "@/lib/crud/types";

const baseOptions: CreateCrudServiceOptions<DefaultInsert<typeof SampleTable>> = {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultSearchFields: [
    "name",
    "description"
  ],
  defaultOrderBy: [["updatedAt", "DESC" as const]],
};

export const base = createCrudService(SampleTable, {
  ...baseOptions,
  parseCreate: (data) => SampleCreateSchema.parse(data),
  parseUpdate: (data) => SampleUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCreateSchema.parse(data),
});
