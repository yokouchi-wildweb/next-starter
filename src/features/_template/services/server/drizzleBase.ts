// src/features/__domain__/services/server/drizzleBase.ts

import { z } from "zod";

import {
  __Domain__CreateSchema,
  __Domain__UpdateSchema,
} from "@/features/__domain__/entities";
import { __Domain__Table } from "@/features/__domain__/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

const __Domain__UpsertSchema = __Domain__CreateSchema.merge(
  z.object({ id: z.string().optional() }),
);

const baseOptions = __serviceOptions__;

export const base = createCrudService(__Domain__Table, {
  ...baseOptions,
  inputSchemas: {
    create: __Domain__CreateSchema,
    update: __Domain__UpdateSchema,
    upsert: __Domain__UpsertSchema,
  },
  validationErrorMessage: "__Domain__の入力内容が正しくありません。",
});
