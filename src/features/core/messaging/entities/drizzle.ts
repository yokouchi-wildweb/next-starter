// src/features/messaging/entities/drizzle.ts
//
// 管理者から送信した「メッセージ」(メール + サービス内通知) のジョブ単位レコード。
// - 1 dispatch = 1 つの管理者アクションが生成した送信ジョブ
// - 受信者単位の追跡は audit_logs に残し、本テーブルは本文・送信者・source 等の
//   ジョブ単位情報を 1 度だけ保存する。これによりバルク送信でも本文が重複しない。

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { MESSAGE_DISPATCH_STATUSES } from "./schema";

export const MessageDispatchTable = pgTable(
  "message_dispatches",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * 送信ジョブの状態。送信開始前に 'processing' で INSERT され、送信処理の完走後に
     * 'completed' へ UPDATE される。processing のまま残っている行は処理が異常終了した
     * 痕跡（メールは送信済みの可能性がある）なので、安易に再実行しないこと。
     * default は既存行のバックフィル用（カラム追加前の行はすべて送信完了後の記録）。
     */
    status: text("status")
      .$type<(typeof MESSAGE_DISPATCH_STATUSES)[number]>()
      .notNull()
      .default("completed"),

    /**
     * 二重送信防止用の冪等性キー（クライアント発行）。UNIQUE 制約により、同一キーの
     * 2 回目の INSERT は送信開始前に失敗する。キーなし送信（NULL）は衝突しない。
     */
    idempotency_key: text("idempotency_key"),

    /** 使用したチャネル: 'email' | 'inApp'. 1 件以上 */
    channels: text("channels").array().notNull(),

    /** メール件名（channels に email が含まれる場合のみ） */
    email_subject: text("email_subject"),
    /** メール本文（channels に email が含まれる場合のみ） */
    email_body: text("email_body"),

    /** 通知タイトル（channels に inApp が含まれる場合のみ） */
    notification_title: text("notification_title"),
    /** 通知本文（channels に inApp が含まれる場合のみ） */
    notification_body: text("notification_body"),

    /** 重複排除後の対象ユーザー数 */
    recipient_count: integer("recipient_count").notNull(),

    /** メール送信成功数 */
    email_success_count: integer("email_success_count").notNull().default(0),
    /** メール送信失敗数 */
    email_failed_count: integer("email_failed_count").notNull().default(0),
    /**
     * 通知レコードが作成されたか。
     * - null: 通知チャネルを使っていない（試行していない）
     * - true: 通知レコードが作成された（全対象ユーザーに配信される）
     * - false: 試行したが失敗
     */
    notification_created: boolean("notification_created"),

    /** 送信元 source 識別子（'userHub.detail.send' / 'shippingRequest.bulk' 等） */
    source: text("source").notNull(),
    /** 送信者の actor_id（ALS から記録） */
    actor_id: text("actor_id"),
    /** 送信者種別（'admin' | 'system' 等） */
    actor_type: text("actor_type"),
    /** 任意の送信理由・備考（管理者入力 or 自動付与） */
    reason: text("reason"),
    /** 任意の付加情報（呼び出し元コンテキストの ID 等） */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** 送信処理が完走し件数が確定した日時（status='completed' になった時刻） */
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_message_dispatches_created_at").on(table.createdAt.desc()),
    index("idx_message_dispatches_actor").on(table.actor_id),
    index("idx_message_dispatches_source").on(table.source),
    uniqueIndex("uq_message_dispatches_idempotency_key").on(
      table.idempotency_key,
    ),
  ],
);
