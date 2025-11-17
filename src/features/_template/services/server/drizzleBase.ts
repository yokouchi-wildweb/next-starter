// src/features/__domain__/services/server/drizzleBase.ts

import { __Domain__Table } from "@/features/__domain__/entities/drizzle";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const baseOptions = __serviceOptions__;

export const base = createCrudService(__Domain__Table, {
  ...baseOptions,
  parseCreate: (data) => __Domain__CreateSchema.parse(data),
  parseUpdate: (data) => __Domain__UpdateSchema.parse(data),
  parseUpsert: (data) => __Domain__CreateSchema.parse(data),
});
