// src/features/core/interactionTracking/entities/drizzle.ts

import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { UserTable } from "@/features/core/user/entities/drizzle";

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

/**
 * インタラクション集計カウンタテーブル（シャーディング付き）。
 *
 * - 単位は (target_type, target_id, action, shard)。読み取りは shard を SUM して合計する。
 * - shard はホットカウンタの行ロック競合対策。人気ターゲットへの同時クリックが
 *   単一行で直列化しないよう、書き込み時にランダムな shard 行へ分散させる
 *   （競合が理論上 1/N になる）。shard 数は INTERACTION_TRACKING_CONFIG.counterShardCount。
 * - 加算は単一文の INSERT ... ON CONFLICT DO UPDATE（原子的・read-modify-write レース無し）。
 * - count は bigint。長期運用でも桁あふれしない（mode: number, 2^53 まで安全）。
 */
export const InteractionCounterTable = pgTable(
  "interaction_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    shard: smallint("shard").notNull().default(0),
    count: bigint("count", { mode: "number" }).notNull().default(0),
    firstOccurredAt: timestamp("first_occurred_at", { withTimezone: true }).notNull().defaultNow(),
    lastOccurredAt: timestamp("last_occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // ON CONFLICT ターゲット兼、(target_type, target_id) 前方一致の集計走査索引
    targetActionShardUnique: uniqueIndex("interaction_counters_target_action_shard_uq").on(
      table.targetType,
      table.targetId,
      table.action,
      table.shard,
    ),
  }),
);

/**
 * インタラクション日次集計テーブル（永久保持・マーケティング分析の真）。
 *
 * - 単位は (date, target_type, target_id, action, source, shard)。
 *   record() 時に明細・累計カウンタと同一トランザクションで原子加算される
 *   （バッチ集計は無い。明細がいつ prune されても集計は最初から完成している）。
 * - 行数は「対象数 × アクション種 × 導線 × 日数」でしか増えず、
 *   ユーザー数・クリック数に比例しない。そのため prune 対象外・永久保持できる。
 * - date の日界は INTERACTION_TRACKING_CONFIG.aggregationTimeZone（既定 Asia/Tokyo）。
 * - source は導線別内訳の集計軸。未指定イベントは '' に正規化する
 *   （Postgres の UNIQUE は NULL 同士を重複と見なさないため NULL を許容しない）。
 * - shard は累計カウンタと同じホット行競合対策。日付が変われば行も分かれるため
 *   競合は日単位でも自然分散するが、単日に集中する用途に備えて同じ手当てを入れる。
 */
export const InteractionDailyCounterTable = pgTable(
  "interaction_daily_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    date: date("date").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    action: text("action").notNull(),
    source: text("source").notNull().default(""),
    shard: smallint("shard").notNull().default(0),
    count: bigint("count", { mode: "number" }).notNull().default(0),
  },
  (table) => ({
    // ON CONFLICT ターゲット
    dailyUnique: uniqueIndex("interaction_daily_counters_uq").on(
      table.date,
      table.targetType,
      table.targetId,
      table.action,
      table.source,
      table.shard,
    ),
    // 対象別の時系列取得（getDailySeries）用
    targetDateIdx: index("interaction_daily_counters_target_idx").on(
      table.targetType,
      table.targetId,
      table.date,
    ),
  }),
);
