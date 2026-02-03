// src/features/rateLimit/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { RateLimitTable } from "@/features/core/rateLimit/entities/drizzle";
import { RateLimitCreateSchema, RateLimitUpdateSchema } from "@/features/core/rateLimit/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = getDomainConfig("rateLimit") as DomainConfig & {
  useSoftDelete?: boolean;
  sortOrderField?: string | null;
};

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((RateLimitTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof RateLimitCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const rateLimitServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/rateLimit/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(RateLimitTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => RateLimitCreateSchema.parse(data),
  parseUpdate: (data) => RateLimitUpdateSchema.parse(data),
  parseUpsert: (data) => RateLimitCreateSchema.parse(data),
});
