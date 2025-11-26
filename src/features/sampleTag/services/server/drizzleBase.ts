// src/features/sampleTag/services/server/drizzleBase.ts

import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
import { SampleTagCreateSchema, SampleTagUpdateSchema } from "@/features/sampleTag/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

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
  ],
} satisfies DrizzleCrudServiceOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/sampleTag/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(SampleTagTable, {
  ...baseOptions,
  parseCreate: (data) => SampleTagCreateSchema.parse(data),
  parseUpdate: (data) => SampleTagUpdateSchema.parse(data),
  parseUpsert: (data) => SampleTagCreateSchema.parse(data),
});
