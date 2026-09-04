// src/features/core/incrementalRefresh/types.ts

import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * dirty 走査の対象ソース。
 * 「このテーブルの行が更新されたら、その id の read-model を再計算する」を宣言する。
 */
export type RefreshSource = {
  table: PgTable;
  /**
   * read-model の id と対応するカラム（例: users.id / wallets.user_id）。
   * 型が uuid でも text でも `::text` に揃えて突き合わせる。
   */
  idColumn: AnyPgColumn;
  /**
   * 更新時刻カラム（updated_at 等）。ウォータマーク走査に使うため、
   * 消費側は `(updated_at)` のインデックスを張ること。
   */
  updatedAtColumn: AnyPgColumn;
  /** 追加条件（例: `sql\`${t.deletedAt} IS NULL\``）。省略時は全行 */
  where?: SQL;
};

/**
 * trickle（低速全走査）フェーズの設定。
 * dirty 走査の取りこぼし（非 HTTP 経路の更新・updated_at が動かない集計等）を
 * 時間をかけて自己修復する安全網。
 */
export type TrickleSweepConfig = {
  /** read-model（スナップショット）テーブル */
  table: PgTable;
  /** read-model の id カラム */
  idColumn: AnyPgColumn;
  /**
   * 「最後に再計算した時刻」カラム（computed_at 等）。ASC NULLS FIRST で最古から処理する。
   * recompute がこのカラムを必ず更新すること（更新されないと同じ行が選ばれ続け、
   * 無進捗として打ち切られる）。
   */
  orderByColumn: AnyPgColumn;
  /** 追加条件。省略時は全行 */
  where?: SQL;
  /** 1 チャンクの件数（既定 100） */
  batchSize?: number;
  /** 1 回の実行で trickle が処理する件数上限（既定 1000） */
  maxPerRun?: number;
};

export type IncrementalRefreshConfig = {
  /**
   * チェックポイント名（cron_checkpoints.name）。タスク固有の一意な名前。
   * 例: "user-metrics-refresh"
   */
  name: string;
  /** dirty 走査のソース（1 つ以上） */
  sources: RefreshSource[];
  /**
   * 再計算本体。id（text 化済み）の配列を受け取り、read-model を冪等に書き直す。
   * dirty / trickle 両フェーズから呼ばれる。集計式やスナップショットのスキーマは
   * 消費側ドメインの責務。
   */
  recompute: (ids: string[]) => Promise<void>;
  /**
   * ウォータマークの重なり幅（ms、既定 120_000）。
   * 走査開始時刻より前に updated_at が採番されたのに、コミットが走査より後になった
   * 行（長寿命トランザクション）を次回に拾うための余裕。想定される最長トランザクション
   * より大きく取る。大きいほど毎回の再処理量が増える。
   */
  overlapMarginMs?: number;
  /** dirty 走査の 1 チャンク件数（既定 200） */
  dirtyChunkSize?: number;
  /** 1 回の実行で dirty 走査が処理する件数上限（省略時は予算のみで制御） */
  dirtyLimitPerRun?: number;
  /**
   * チェックポイント未登録時の初期値（既定 `new Date(0)` = 全行を対象に初回バックフィル。
   * 予算付きなので複数回の実行に分かれて自然に完走する）。
   * 導入前の履歴を捨ててよいなら `new Date()` 等を渡す。
   */
  initialCheckpoint?: Date;
  /** 低速全走査の安全網。省略時は dirty 走査のみ */
  trickle?: TrickleSweepConfig;
};

export type RunIncrementalRefreshOptions = {
  /**
   * この実行に使ってよい時間（ms）。serverless の maxDuration から
   * 1 チャンクの最大所要時間 + 起動/後片付けの余裕を差し引いた値を渡す
   * （例: maxDuration 300s → 240_000）。
   */
  budgetMs: number;
  /** trickle フェーズを飛ばす（dirty のみ）。運用時の切り分け用 */
  skipTrickle?: boolean;
};

export type IncrementalRefreshResult = {
  /** dirty 走査で再計算した件数 */
  dirtyProcessed: number;
  /** dirty 走査のチャンク数 */
  dirtyChunks: number;
  /** dirty 対象を使い切った（false = 予算/上限で次回持ち越し） */
  dirtyExhausted: boolean;
  /** trickle で再計算した件数 */
  trickleProcessed: number;
  /** trickle の停止理由（未実行なら "skipped"） */
  trickleStopReason: "skipped" | "exhausted" | "deadline" | "maxPerRun" | "noProgress";
  /** 実行後のチェックポイント（ISO 8601） */
  checkpointAt: string;
  /** 実行開始時のチェックポイント（ISO 8601） */
  previousCheckpointAt: string;
  /** 予算で打ち切られたフェーズがあった */
  budgetExhausted: boolean;
  durationMs: number;
};

export type IncrementalRefreshRunner = (
  options: RunIncrementalRefreshOptions,
) => Promise<IncrementalRefreshResult>;
