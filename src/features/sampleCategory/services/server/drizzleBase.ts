// src/features/sampleCategory/services/server/drizzleBase.ts

import { getDomainConfig } from "@/features/core/domainConfig/getDomainConfig";
import { SampleCategoryTable } from "@/features/sampleCategory/entities/drizzle";
import { SampleCategoryCreateSchema, SampleCategoryUpdateSchema } from "@/features/sampleCategory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("sampleCategory");

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
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
  parseCreate: (data) => SampleCategoryCreateSchema.parse(data),
  parseUpdate: (data) => SampleCategoryUpdateSchema.parse(data),
  parseUpsert: (data) => SampleCategoryCreateSchema.parse(data),
});
