// src/features/sample/services/server/drizzleBase.ts

import { SampleTable, SampleToSampleTagTable } from "@/features/sample/entities/drizzle";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
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
  belongsToManyRelations: [
  {
    fieldName: "sample_tag_ids",
    throughTable: SampleToSampleTagTable,
    sourceColumn: SampleToSampleTagTable.sampleId,
    targetColumn: SampleToSampleTagTable.sampleTagId,
    sourceProperty: "sampleId",
    targetProperty: "sampleTagId",
  }
  ],
} satisfies DrizzleCrudServiceOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/sample/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(SampleTable, {
  ...baseOptions,
  parseCreate: (data) => SampleCreateSchema.parse(data),
  parseUpdate: (data) => SampleUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCreateSchema.parse(data),
});
