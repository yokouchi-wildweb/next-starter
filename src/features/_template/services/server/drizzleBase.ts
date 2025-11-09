// src/features/__domain__/services/server/drizzleBase.ts

import { __Domain__Table } from "@/features/__domain__/entities/drizzle";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";

const options = __serviceOptions__;

export const base = createCrudService(__Domain__Table, {
  ...options,
  schemas: {
    create: __Domain__CreateSchema,
    update: __Domain__UpdateSchema,
    upsert: __Domain__CreateSchema,
  },
});
