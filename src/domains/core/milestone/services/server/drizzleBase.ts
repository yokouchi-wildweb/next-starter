// src/domains/milestone/services/server/drizzleBase.ts

import { normalizeDomainJsonConfig } from "@/lib/domain";
import type { DomainConfigOptionals } from "@/lib/domain";
import rawConf from "@/domains/milestone/domain.json";
import { MilestoneTable } from "@/domains/core/milestone/entities/drizzle";
import { MilestoneCreateSchema, MilestoneUpdateSchema } from "@/domains/core/milestone/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";
import type { IdStrategy, OrderBySpec } from "@/lib/crud";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = normalizeDomainJsonConfig(rawConf) as typeof rawConf & DomainConfigOptionals;

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((MilestoneTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdStrategy,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies CrudServiceOptions<
  z.infer<typeof MilestoneCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const milestoneServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/domains/milestone/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(MilestoneTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => MilestoneCreateSchema.parse(data),
  parseUpdate: (data) => MilestoneUpdateSchema.parse(data),
  parseUpsert: (data) => MilestoneCreateSchema.parse(data),
});
