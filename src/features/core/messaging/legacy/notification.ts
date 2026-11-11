// src/features/core/messaging/legacy/notification.ts
//
// 前のお知らせの表(notifications・notification_reads・notification_read_states)と enum の定義だけ。サービスも読み手も無い
// (どこからも import しない)。表を push が消さないよう schemaRegistry に載せておく(D55。名前・FK の名前・index は前と同じ)。
// 写しの task が新しい受け取り箱へ写し、S3 の初めに消す。README: ./README.md

import { boolean, foreignKey, index, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { UserTable } from "@/features/core/user/entities/drizzle";

import { NotificationTemplateTable } from "./notificationTemplate";

export const NotificationTargetTypeEnum = pgEnum("notification_target_type_enum", ["all", "role", "individual"]);
export const NotificationSenderTypeEnum = pgEnum("notification_sender_type_enum", ["admin", "system"]);

export const NotificationTable = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    notification_template_id: uuid("notification_template_id"),
    title: text("title"),
    body: text("body").notNull(),
    image: text("image"),
    target_type: NotificationTargetTypeEnum("target_type").notNull(),
    target_user_ids: text("target_user_ids").array(),
    target_roles: text("target_roles").array(),
    sender_type: NotificationSenderTypeEnum("sender_type").notNull(),
    created_by_id: uuid("created_by_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    is_silent: boolean("is_silent").default(false).notNull(),
    published_at: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "notifications_notification_template_id_fk",
      columns: [table.notification_template_id],
      foreignColumns: [NotificationTemplateTable.id],
    }).onDelete("set null"),
    index("notifications_published_at_id_idx").on(table.published_at, table.id),
  ],
);

export const NotificationReadTable = pgTable(
  "notification_reads",
  {
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => NotificationTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.notificationId, table.userId] }),
    index("notification_reads_user_id_idx").on(table.userId),
  ],
);

export const NotificationReadStateTable = pgTable("notification_read_states", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  readWatermarkAt: timestamp("read_watermark_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
