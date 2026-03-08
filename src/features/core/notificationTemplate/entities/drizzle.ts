// src/features/notificationTemplate/entities/drizzle.ts

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
