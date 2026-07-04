// src/features/core/analytics/entities/drizzle.ts
// analytics ドメインのテーブル定義
//  - user_daily_activities: DAU（日次アクティブユーザー）計測
//  - analytics_daily_rollups: 日次メトリクス事前集計（ロールアップ）

import {
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const UserDailyActivityTable = pgTable(
  "user_daily_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    activityDate: date("activity_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex("user_daily_activities_user_date_idx").on(
      table.userId,
      table.activityDate,
    ),
    activityDateIdx: index("user_daily_activities_activity_date_idx").on(table.activityDate),
  }),
);

/**
 * 日次メトリクス事前集計（ロールアップ）テーブル。
 *
 * ソーステーブルから再計算可能な「派生キャッシュ」であり、真実のソースではない。
 * 行は analyticsRollupRegistry に登録されたメトリクス計算機（compute）の出力を
 * 冪等 upsert（日単位で delete → insert）した結果。
 *
 * - metric_key: レジストリ上のメトリクス識別子（例: "wallet.closing_balance"）
 * - bucket_date: 集計対象日（メトリクスのタイムゾーン上のローカル日付）
 * - dims_key: ディメンションの正規化キー（canonicalizeDims の出力。ディメンション無し = ""）
 * - dims: ディメンションの生値（読み戻し用。dims_key が正規形）
 * - value: メトリクス値。kind=flow なら日次合計、kind=snapshot なら日末クロージング値
 */
export const AnalyticsDailyRollupTable = pgTable(
  "analytics_daily_rollups",
  {
    metricKey: text("metric_key").notNull(),
    bucketDate: date("bucket_date").notNull(),
    dimsKey: text("dims_key").notNull().default(""),
    dims: jsonb("dims"),
    value: numeric("value").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({
      name: "analytics_daily_rollups_pk",
      columns: [table.metricKey, table.bucketDate, table.dimsKey],
    }),
  }),
);
