// src/features/__domain__/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain/getDomainConfig";
import { __DrizzleEntityImports__ } from "@/features/__domain__/entities/drizzle";
import { __Domain__CreateSchema, __Domain__UpdateSchema } from "@/features/__domain__/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { z } from "zod";

const conf = getDomainConfig("__domain__") as DomainConfig & { useSoftDelete?: boolean };

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,
__belongsToManyRelations__
} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof __Domain__CreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const __domain__ServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/__domain__/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(__Domain__Table, {
  ...baseOptions,
  parseCreate: (data) => __Domain__CreateSchema.parse(data),
  parseUpdate: (data) => __Domain__UpdateSchema.parse(data),
  parseUpsert: (data) => __Domain__CreateSchema.parse(data),
});
