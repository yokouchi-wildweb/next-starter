// src/features/sampleCategory/services/server/drizzleBase.ts

import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import type { DomainConfigOptionals } from "@/lib/domain/types/domainConfigOptionals";
import rawConf from "@/features/sampleCategory/domain.json";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleTable, SampleToSampleTagTable } from "@/features/sample/entities/drizzle";
import { SampleTagTable } from "@/features/sampleTag/entities/drizzle";
import { SampleCategoryCreateSchema, SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec, SearchRankSpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = normalizeDomainJsonConfig(rawConf) as typeof rawConf & DomainConfigOptionals;

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((SampleCategoryTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
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
  hasManyRelations: [
    {
      field: "samples",
      table: SampleTable,
      foreignKey: "sample_category_id",
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
  z.infer<typeof SampleCategoryCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const sampleCategoryServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/sampleCategory/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(SampleCategoryTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => SampleCategoryCreateSchema.parse(data),
  parseUpdate: (data) => SampleCategoryUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCategoryCreateSchema.parse(data),
});
