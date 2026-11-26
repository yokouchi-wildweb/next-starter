// src/domains/core/interactionTracking/entities/interactionEvent/drizzle.ts

import { UserTable } from "@/domains/core/user/entities/drizzle";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * 汎用インタラクションイベントテーブル（追記専用）。
 *
 * 匿名ユーザーを含む行動イベント（クリック等）を
 * (target_type, target_id, action) 単位で記録する。
 *
 * 設計ポイント:
 * - append-only。更新・削除経路は retention pruning（cron）のみ。
 * - user_id は nullable（匿名許容）。ユーザー削除時は SET NULL で匿名化して残す。
 * - target_id は text。対象テーブルの PK 型（uuid / int / 複合キー文字列）に依存しない。
 * - 集計の読み取りは常に interaction_counters 側を使う。
 *   イベントを prune しても合計値が狂わないための分離（本テーブルは明細・分析用）。
 * - 行単位 retention_days を持ち、日次 cron でプルーニングする
 *   （audit_logs / user_login_events と同じ運用パターン）。
 */
export const InteractionEventTable = pgTable(
  "interaction_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    // 発生箇所の語彙（例: home | list | deep_link）。採番は消費側ドメインの責務
    source: text("source"),
    userId: uuid("user_id").references(() => UserTable.id, { onDelete: "set null" }),
    // 将来拡張（インプレッション計測のバッチ送信メタ等）用。公開 ingest からは受け付けない
    metadata: jsonb("metadata"),
    retentionDays: integer("retention_days").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // 対象別の明細参照・再集計用
    targetIdx: index("interaction_events_target_idx").on(
      table.targetType,
      table.targetId,
      table.action,
      table.createdAt,
    ),
    // 将来の userSegment 連携（「target X をクリックしたユーザー」）用
    userIdx: index("interaction_events_user_idx").on(table.userId, table.createdAt),
    // retention pruning 用（created_at + retention_days * INTERVAL で算出）
    createdAtIdx: index("interaction_events_created_at_idx").on(table.createdAt),
  }),
);
