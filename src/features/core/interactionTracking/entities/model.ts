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
