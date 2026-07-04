// src/features/core/interactionTracking/entities/model.ts

export type InteractionEvent = {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  source: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  retentionDays: number;
  createdAt: Date;
};

export type InteractionCounter = {
  id: string;
  targetType: string;
  targetId: string;
  action: string;
  shard: number;
  count: number;
  firstOccurredAt: Date;
  lastOccurredAt: Date;
};

export type InteractionDailyCounter = {
  id: string;
  date: string;
  targetType: string;
  targetId: string;
  action: string;
  source: string;
  shard: number;
  count: number;
};

/** action → 合計カウント */
export type InteractionCounts = Map<string, number>;

/** targetId → (action → 合計カウント)。管理一覧のカラム表示用 */
export type InteractionCountsBulk = Map<string, InteractionCounts>;

/** 日次時系列の 1 点（shard は合算済み）。source 未指定イベントは "" */
export type InteractionDailySeriesPoint = {
  /** YYYY-MM-DD（aggregationTimeZone の日界） */
  date: string;
  action: string;
  source: string;
  count: number;
};

/** オーディエンス一覧の並び順（lastClickedAt=新しい順 / clickCount=回数順） */
export type InteractionAudienceOrderBy = "lastClickedAt" | "clickCount";

/** オーディエンス一覧の 1 行（ユーザー単位に集約。ログイン済みイベントのみ） */
export type InteractionAudienceEntry = {
  userId: string;
  /** users テーブルの表示名（未設定は null） */
  name: string | null;
  email: string | null;
  clickCount: number;
  /** 最終アクション日時（ISO 8601） */
  lastClickedAt: string;
};

/** アクション 1 種別ぶんのオーディエンスサマリー */
export type InteractionAudienceSummary = {
  /** 累計（interaction_counters 由来・永久） */
  lifetimeTotal: number;
  /** ログイン済みイベント数（明細由来・保持期限内のみ） */
  loggedInCount: number;
  /** 匿名イベント数（明細由来・保持期限内のみ。削除ユーザーもここに合流） */
  anonymousCount: number;
};

/** action → サマリー。HTTP で返すため Map ではなく Record */
export type InteractionAudienceSummaryMap = Record<string, InteractionAudienceSummary>;
