// src/features/sample/services/server/drizzleBase.ts

import { z } from "zod";

import {
  SampleCreateSchema,
  SampleUpdateSchema,
} from "@/features/sample/entities";
import { SampleTable } from "@/features/sample/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";

const SampleUpsertSchema = SampleCreateSchema.merge(
  z.object({ id: z.string().optional() }),
);

export const base = createCrudService(SampleTable, {
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
  ],
  inputSchemas: {
    create: SampleCreateSchema,
    update: SampleUpdateSchema,
    upsert: SampleUpsertSchema,
  },
  validationErrorMessage: "サンプルの入力内容が正しくありません。",
});
