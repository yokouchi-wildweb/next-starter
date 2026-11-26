// src/domains/core/messaging/entities/messageEndpoint/drizzle.ts

import { UserTable } from "@/domains/user/entities/drizzle";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageEndpointTable = pgTable(
  "message_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    /** 宛先（トークン・電話番号など） */
    address: text("address").notNull(),
    /** 宛先の種類（web / ios / android など、送信チャンネルが決める） */
    kind: text("kind"),
    /** 付加情報（秘密は入れない） */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    is_active: boolean("is_active").notNull().default(true),
    last_used_at: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_endpoints_channel_address").on(
      table.channel,
      table.address,
    ),
    index("idx_message_endpoints_user").on(table.user_id),
  ],
);
