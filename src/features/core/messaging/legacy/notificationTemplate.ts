// src/features/core/messaging/legacy/notificationTemplate.ts
//
// 前のお知らせのテンプレートの表(notification_templates)の定義だけ。サービスも読み手も無い(どこからも import しない)。
// 表を push が消さないよう schemaRegistry に載せておく(D55)。写しの task が使い、S3 の初めに消す。README: ./README.md

import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const NotificationTemplateCategoryEnum = pgEnum("notificationTemplate_category_enum", ["system", "manual"]);

export const NotificationTemplateTable = pgTable("notification_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  variables: jsonb("variables"),
  category: NotificationTemplateCategoryEnum("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
