// src/features/sampleImage/services/server/drizzleBase.ts

import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import type { DomainConfigOptionals } from "@/lib/domain/types/domainConfigOptionals";
import rawConf from "@/features/sampleImage/domain.json";
import { SampleImageTable } from "@/features/sampleImage/entities/drizzle";
import { SampleTable, SampleToSampleTagTable } from "@/features/sample/entities/drizzle";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
import { SampleImageCreateSchema, SampleImageUpdateSchema } from "@/features/sampleImage/entities/schema";
import { storageBindingFor } from "@/features/core/storageObject/services/server/crudBinding";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec, SearchRankSpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = normalizeDomainJsonConfig(rawConf) as typeof rawConf & DomainConfigOptionals;

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((SampleImageTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
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
  belongsToRelations: [
    {
      field: "sample",
      foreignKey: "sample_id",
      table: SampleTable,
      useSoftDelete: true,
      deletedAtColumn: SampleTable.deletedAt,
      nested: {
        belongsTo: [
          {
            field: "sample_category",
            foreignKey: "sample_category_id",
            table: SampleCategoryTable,
          }
        ],
        belongsToMany: [
          {
            field: "sample_tags",
            idField: "sample_tag_ids",
            targetTable: SampleTagTable,
            throughTable: SampleToSampleTagTable,
            sourceColumn: SampleToSampleTagTable.sampleId,
            targetColumn: SampleToSampleTagTable.sampleTagId,
          }
        ],
      },
    }
  ],

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof SampleImageCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const sampleImageServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/sampleImage/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(SampleImageTable, {
  ...baseOptions,
  sortOrderColumn,
  // メディア列の値（storage ref）をファイル台帳に紐付ける。複製・物理削除時のファイル処理もここで行う
  storage: storageBindingFor("sampleImage", [
    { name: "file", purpose: "sampleImage.file", multi: false },
  ]),
  parseCreate: (data) => SampleImageCreateSchema.parse(data),
  parseUpdate: (data) => SampleImageUpdateSchema.parse(data),
  parseUpsert: (data) => SampleImageCreateSchema.parse(data),
});
