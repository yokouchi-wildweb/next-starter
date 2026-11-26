// src/domains/core/messaging/entities/messageDelivery/drizzle.ts

import { MessageDispatchTable } from "../messageDispatch/drizzle";
import { MESSAGE_DELIVERY_REASONS, MESSAGE_DELIVERY_STATUSES } from "./schema";
import type { MessageDeliveryTarget } from "./schema";
import { UserTable } from "@/domains/user/entities/drizzle";
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const MessageDeliveryTable = pgTable(
  "message_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dispatch_id: uuid("dispatch_id")
      .notNull()
      .references(() => MessageDispatchTable.id, { onDelete: "cascade" }),
    /** 受信者の鍵（user:<id> | addr:<hash>）。住所を消しても変わらない */
    recipient_key: text("recipient_key").notNull(),
    /** 利用者（宛先だけの送信と、利用者を消した後は null） */
    user_id: uuid("user_id").references(() => UserTable.id, {
      onDelete: "set null",
    }),
    /** 送った宛先（宛先が複数の送信チャンネルは targets 側） */
    address: text("address"),
    channel: text("channel").notNull(),
    status: text("status")
      .$type<(typeof MESSAGE_DELIVERY_STATUSES)[number]>()
      .notNull()
      .default("queued"),
    /** 送らなかった理由（suppressed などのとき） */
    reason: text("reason").$type<(typeof MESSAGE_DELIVERY_REASONS)[number]>(),
    attempts: integer("attempts").notNull().default(0),
    /** 次に送り直す時刻（null = 送り直さない） */
    next_attempt_at: timestamp("next_attempt_at", { withTimezone: true }),
    /** lease: この時刻までは他の処理が行を取らない */
    locked_until: timestamp("locked_until", { withTimezone: true }),
    /** lease を取った処理の印 */
    lock_token: text("lock_token"),
    last_error: text("last_error"),
    provider: text("provider"),
    provider_message_id: text("provider_message_id"),
    /** 宛先ごとの状態（複数の宛先を持つ送信チャンネル） */
    targets: jsonb("targets").$type<MessageDeliveryTarget[]>(),
    /** 受信者ごとの変数の写し（record が vars / full のとき。secret の印の鍵は落とす） */
    vars: jsonb("vars").$type<Record<string, unknown>>(),
    /** 受信者ごとの描いた本文（record が full のときだけ） */
    body: jsonb("body").$type<Record<string, unknown>>(),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    failed_at: timestamp("failed_at", { withTimezone: true }),
    /** 最初に開いた時刻 */
    opened_at: timestamp("opened_at", { withTimezone: true }),
    clicked_at: timestamp("clicked_at", { withTimezone: true }),
    complained_at: timestamp("complained_at", { withTimezone: true }),
    /**
     * 間引きの鍵(throttle のある連絡で、受信者の送り方を決めた行だけ。受信者 × message_key × by の値の hash)。
     * window の起点 = この鍵の sent の行(reason throttled の行は起点にしない)
     */
    throttle_key: text("throttle_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_message_deliveries_recipient").on(
      table.dispatch_id,
      table.channel,
      table.recipient_key,
    ),
    index("idx_message_deliveries_status_next").on(
      table.status,
      table.next_attempt_at,
    ),
    index("idx_message_deliveries_provider_msg").on(
      table.provider,
      table.provider_message_id,
    ),
    // 利用者ごとの履歴(新しい順の keyset)。user_id だけの検索(利用者の削除の set null)もこの先頭で引く
    index("idx_message_deliveries_user_created").on(
      table.user_id,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("idx_message_deliveries_created_at").on(table.createdAt),
    // 保持の重い列の段(sweep/retentionSql.ts expiredDeliveryContentClearSql): 中身の残る行だけを古い順に引く。
    // 行は deliveriesDays まで残るので、これが無いと毎回 null にし終えた行を読み直す。述語は SQL と同じ文字で書く(db:push:check が 0 になる)
    index("idx_message_deliveries_content_created")
      .on(table.createdAt)
      .where(sql`body IS NOT NULL OR vars IS NOT NULL`),
    // 間引きの window の起点(同じ鍵の最後の送り)
    index("idx_message_deliveries_throttle_sent").on(table.throttle_key, table.sent_at),
  ],
);
