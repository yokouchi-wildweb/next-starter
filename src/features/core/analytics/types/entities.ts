// src/features/core/analytics/types/entities.ts
// エンティティ追加時の基底型
// アップストリームではエンティティを持たない。下流がentities/にテーブルを追加する際の型契約。

// ============================================================================
// 集計キャッシュ
// ============================================================================

/**
 * 集計キャッシュの共通フィールド
 *
 * 重い集計クエリの事前計算結果を保持するテーブルの型契約。
 * 日次バッチ等で定期的にresultを更新する想定。
 *
 * @example
 * // drizzle.ts での実装例:
 * export const AnalyticsCacheTable = pgTable("analytics_cache", {
 *   id: uuid("id").defaultRandom().primaryKey(),
 *   metric_key: text("metric_key").notNull(),
 *   period_start: timestamp("period_start", { withTimezone: true }).notNull(),
 *   period_end: timestamp("period_end", { withTimezone: true }).notNull(),
 *   granularity: text("granularity").notNull().default("daily"),
 *   parameters: jsonb("parameters").default({}),
 *   result: jsonb("result").notNull(),
 *   computed_at: timestamp("computed_at", { withTimezone: true }).defaultNow(),
 * });
 */
export type AnalyticsCacheBase = {
  id: string;
  /** メトリクスキー（例: "daily_wallet_summary", "monthly_revenue"） */
  metric_key: string;
  /** 集計期間の開始 */
  period_start: Date;
  /** 集計期間の終了 */
  period_end: Date;
  /** 集計粒度 */
  granularity: "daily" | "weekly" | "monthly";
  /** フィルタ条件（walletType等） */
  parameters: Record<string, unknown>;
  /** 集計結果のJSON */
  result: Record<string, unknown>;
  /** 計算実行日時 */
  computed_at: Date;
};

// ============================================================================
// スナップショット
// ============================================================================

/**
 * スナップショットの共通フィールド
 *
 * ある時点の状態を定期記録するテーブルの型契約。
 * 残高分布、ユーザー数推移など、差分では再現できないデータに使用。
 *
 * @example
 * // drizzle.ts での実装例:
 * export const AnalyticsSnapshotTable = pgTable("analytics_snapshots", {
 *   id: uuid("id").defaultRandom().primaryKey(),
 *   snapshot_key: text("snapshot_key").notNull(),
 *   snapshot_date: timestamp("snapshot_date", { withTimezone: true }).notNull(),
 *   data: jsonb("data").notNull(),
 *   created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
 * });
 */
export type AnalyticsSnapshotBase = {
  id: string;
  /** スナップショットキー（例: "wallet_balance_distribution", "active_users"） */
  snapshot_key: string;
  /** スナップショット日 */
  snapshot_date: Date;
  /** スナップショットデータのJSON */
  data: Record<string, unknown>;
  /** 作成日時 */
  created_at: Date;
};

// ============================================================================
// ダッシュボード設定
// ============================================================================

/**
 * ダッシュボード設定の共通フィールド
 *
 * 管理者ごとの表示カスタマイズを保持するテーブルの型契約。
 *
 * @example
 * // drizzle.ts での実装例:
 * export const DashboardConfigTable = pgTable("dashboard_configs", {
 *   id: uuid("id").defaultRandom().primaryKey(),
 *   user_id: uuid("user_id").notNull(),
 *   config_key: text("config_key").notNull().default("default"),
 *   settings: jsonb("settings").notNull(),
 *   updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
 * });
 */
export type DashboardConfigBase = {
  id: string;
  /** 設定を所有するユーザーID */
  user_id: string;
  /** 設定キー（複数設定パターンに対応。デフォルト: "default"） */
  config_key: string;
  /** 設定JSON（表示メトリクス、デフォルト期間、レイアウト等） */
  settings: Record<string, unknown>;
  /** 更新日時 */
  updated_at: Date;
};
