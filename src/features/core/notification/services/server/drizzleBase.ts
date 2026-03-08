// src/features/notification/services/server/drizzleBase.ts

import { getDomainConfig, type DomainConfig } from "@/lib/domain";
import { NotificationTable } from "@/features/core/notification/entities/drizzle";
import { NotificationTemplateTable } from "@/features/notificationTemplate/entities/drizzle";
import { NotificationCreateSchema, NotificationUpdateSchema } from "@/features/core/notification/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { IdType, OrderBySpec } from "@/lib/crud/types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { z } from "zod";

const conf = getDomainConfig("notification") as DomainConfig & {
  useSoftDelete?: boolean;
  sortOrderField?: string | null;
};

// sortOrderField が設定されている場合、対応するカラムを取得
const sortOrderColumn = conf.sortOrderField
  ? ((NotificationTable as unknown as Record<string, unknown>)[conf.sortOrderField] as AnyPgColumn)
  : undefined;

export const baseOptions = {
  idType: conf.idType as IdType,
  useCreatedAt: conf.useCreatedAt,
  useUpdatedAt: conf.useUpdatedAt,
  useSoftDelete: conf.useSoftDelete,
  defaultSearchFields: conf.searchFields,
  defaultOrderBy: conf.defaultOrderBy as OrderBySpec,
  belongsToRelations: [
    {
      field: "notification_template",
      foreignKey: "notification_template_id",
      table: NotificationTemplateTable,
    }
  ],

} satisfies DrizzleCrudServiceOptions<
  z.infer<typeof NotificationCreateSchema>
>;

// 互換性のためエイリアスもエクスポート
export const notificationServiceOptions = baseOptions;

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/notification/services/server/wrappers/ 以下にラップを作成して差し替えること。

export const base = createCrudService(NotificationTable, {
  ...baseOptions,
  sortOrderColumn,
  parseCreate: (data) => NotificationCreateSchema.parse(data),
  parseUpdate: (data) => NotificationUpdateSchema.parse(data),
  parseUpsert: (data) => NotificationCreateSchema.parse(data),
});
