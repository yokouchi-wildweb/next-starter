// src/features/couponHistory/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { CouponHistoryTable } from "@/features/core/couponHistory/entities/drizzle";
import { CouponHistoryCreateSchema, CouponHistoryUpdateSchema } from "@/features/core/couponHistory/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = getDomainConfig("couponHistory") as DomainConfig & {
  useSoftDelete?: boolean;
  sortOrderField?: string | null;
};

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((CouponHistoryTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof CouponHistoryCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const couponHistoryServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/couponHistory/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(CouponHistoryTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => CouponHistoryCreateSchema.parse(data),
  parseUpdate: (data) => CouponHistoryUpdateSchema.parse(data),
  parseUpsert: (data) => CouponHistoryCreateSchema.parse(data),
});
