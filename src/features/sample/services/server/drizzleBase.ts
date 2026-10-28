// src/features/sample/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { SampleTable, SampleToSampleTagTable } from "@/features/sample/entities/drizzle";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
import { SampleCreateSchema, SampleUpdateSchema } from "@/features/sample/entities/schema";
import { storageBindingFor } from "@/features/core/storageObject/services/server/crudBinding";
import { collections } from "./collections";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec, SearchRankSpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = getDomainConfig("sample");

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((SampleTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  // 関連度ランキング（searchRank: true 時のフィールド重み。未宣言なら searchFields 等重み）
  defaultSearchRank: conf.searchRank as SearchRankSpec | undefined,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,
  // systemUpdate / systemBulkUpdateByQuery（特権書き込み）の allowlist（未宣言なら無効）
  systemColumns: conf.systemColumns,
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
      idField: "sample_tag_ids",
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
  sortOrderColumn,
  // メディア列の値（storage ref）をファイル台帳に紐付ける。複製・物理削除時のファイル処理もここで行う
  storage: storageBindingFor("sample", [
    { name: "main_image", purpose: "sample.main_image", multi: false },
    { name: "sub_image", purpose: "sample.sub_image", multi: false },
  ]),
  // 主の集まりの項目（従属ドメインの行の並び）を同じ TX で差分同期する。宣言は collections.ts
  collections,
  parseCreate: (data) => SampleCreateSchema.parse(data),
  parseUpdate: (data) => SampleUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCreateSchema.parse(data),
});
