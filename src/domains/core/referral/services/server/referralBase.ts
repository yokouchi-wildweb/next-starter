// src/domains/core/referral/services/server/referralBase.ts

import { normalizeEntityDeclaration } from "@/lib/domain";
import type { DomainConfigOptionals } from "@/lib/domain";
import rawConf from "@/domains/referral/entities/referral/entity.json";
import { ReferralTable } from "@/domains/core/referral/entities/drizzle";
import { ReferralCreateSchema, ReferralUpdateSchema } from "@/domains/core/referral/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";
import type { IdStrategy, OrderBySpec } from "@/lib/crud";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = normalizeEntityDeclaration(rawConf) as typeof rawConf & DomainConfigOptionals;

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((ReferralTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdStrategy,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies CrudServiceOptions<
  z.infer<typeof ReferralCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const referralServiceOptions = baseOptions;

// NOTE: referralBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/domains/referral/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const referralBase = createCrudService(ReferralTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => ReferralCreateSchema.parse(data),
  parseUpdate: (data) => ReferralUpdateSchema.parse(data),
  parseUpsert: (data) => ReferralCreateSchema.parse(data),
});
