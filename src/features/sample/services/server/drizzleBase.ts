// src/features/sample/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { SampleTable, SampleToSampleTagTable } from "@/features/sample/entities/drizzle";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("sample") as DomainConfig & { useSoftDelete?: boolean };

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,
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
  belongsToRelations: [
    {
      field: "sample_category",
      foreignKey: "sample_category_id",
      table: SampleCategoryTable,
    }
  ],
  belongsToManyObjectRelations: [
    {
      field: "sample_tags",
      targetTable: SampleTagTable,
      throughTable: SampleToSampleTagTable,
      sourceColumn: SampleToSampleTagTable.sampleId,
      targetColumn: SampleToSampleTagTable.sampleTagId,
    }
  ],
  countableRelations: [
    {
      field: "sample_tags",
      throughTable: SampleToSampleTagTable,
      foreignKey: "sampleId",
    }
  ],

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof SampleCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const sampleServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/sample/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(SampleTable, {
  ...baseOptions,
  sortOrderColumn: SampleTable.sortOrder,
  parseCreate: (data) => SampleCreateSchema.parse(data),
  parseUpdate: (data) => SampleUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCreateSchema.parse(data),
});
