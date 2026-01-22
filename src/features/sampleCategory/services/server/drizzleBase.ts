// src/features/sampleCategory/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleCategoryCreateSchema, SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = getDomainConfig("sampleCategory") as DomainConfig & {
  useSoftDelete?: boolean;
  sortOrderField?: string | null;
};

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
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

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
