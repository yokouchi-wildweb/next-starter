// src/features/notificationTemplate/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { NotificationTemplateTable } from "@/features/core/notificationTemplate/entities/drizzle";
import { NotificationTemplateCreateSchema, NotificationTemplateUpdateSchema } from "@/features/core/notificationTemplate/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = getDomainConfig("notificationTemplate") as DomainConfig & {
  useSoftDelete?: boolean;
  sortOrderField?: string | null;
};

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((NotificationTemplateTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof NotificationTemplateCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const notificationTemplateServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/notificationTemplate/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(NotificationTemplateTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => NotificationTemplateCreateSchema.parse(data),
  parseUpdate: (data) => NotificationTemplateUpdateSchema.parse(data),
  parseUpsert: (data) => NotificationTemplateCreateSchema.parse(data),
});
