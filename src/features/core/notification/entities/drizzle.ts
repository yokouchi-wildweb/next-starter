// src/features/notification/entities/drizzle.ts

import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { NotificationTemplateTable } from "@/features/notificationTemplate/entities/drizzle";

export const NotificationTargetTypeEnum = pgEnum("notification_target_type_enum", ["all", "role", "individual"]);
export const NotificationSenderTypeEnum = pgEnum("notification_sender_type_enum", ["admin", "system"]);

export const NotificationTable = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  notification_template_id: uuid("notification_template_id")
    .references(() => NotificationTemplateTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  target_type: NotificationTargetTypeEnum("target_type").notNull(),
  target_user_ids: text("target_user_ids").array(),
  target_roles: text("target_roles").array(),
  sender_type: NotificationSenderTypeEnum("sender_type").notNull(),
  created_by_id: uuid("created_by_id"),
  published_at: timestamp("published_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
