// マイルストーンフレームワークの型定義
//
// ベースリポジトリではフレームワークのみ提供。
// 下流プロジェクトが registerMilestone() で具体的なマイルストーンを登録する。

import type { TransactionClient } from "@/lib/drizzle/transaction";

/**
 * マイルストーン評価時に渡されるイベントコンテキスト
 *
 * payload はトリガーごとに自由な構造。
 * evaluate 内で必要なデータを payload から取得するか、サービスを直接呼び出す。
 */
export type MilestoneEventContext = {
  /** 対象ユーザーID */
  userId: string;
  /** トリガー名 */
  trigger: string;
  /** イベント固有のデータ（呼び出し元が自由に渡す） */
  payload: Record<string, unknown>;
};

/**
 * onAchieved コールバックに渡されるパラメータ
 */
export type MilestoneAchievedParams = {
  userId: string;
  milestoneKey: string;
  context: MilestoneEventContext;
  tx?: TransactionClient;
};

/**
 * マイルストーン定義
 *
 * 下流プロジェクトでの使い方:
 * ```ts
 * registerMilestone({
 *   key: "first_purchase",
 *   triggers: ["purchase_completed"],
 *   evaluate: async ({ userId }, tx) => {
 *     // tx が渡された場合、トランザクション内の最新状態を参照できる
 *     const { data } = await purchaseRequestService.search({ ... });
 *     return data.length === 1;
 *   },
 *   onAchieved: async ({ userId, tx }) => {
 *     // 報酬付与などの処理
 *     return { reward: "500 coins" };
 *   },
 * });
 * ```
 */
export type MilestoneDefinition = {
  /** マイルストーンの一意キー（user_id と組み合わせて冪等性を保証） */
  key: string;
  /** どのイベントで評価するか（複数指定可） */
  triggers: string[];
  /** 達成条件の評価関数。true を返すと達成として記録される。tx が渡された場合はトランザクション内の最新状態を参照可能 */
  evaluate: (context: MilestoneEventContext, tx?: TransactionClient) => Promise<boolean>;
  /** 達成時のコールバック（オプション）。戻り値は metadata として保存される */
  onAchieved?: (params: MilestoneAchievedParams) => Promise<Record<string, unknown> | void>;
};

/**
 * 個別マイルストーンの評価結果
 */
export type MilestoneEvaluationResult = {
  key: string;
  achieved: boolean;
  metadata?: Record<string, unknown> | void;
};

/**
 * evaluateMilestones の戻り値
 */
export type EvaluateMilestonesResult = {
  trigger: string;
  results: MilestoneEvaluationResult[];
};

/**
 * jsonb に永続化するためのシリアライズ型
 *
 * evaluateMilestones の結果を purchase_requests.milestone_results に保存する際に使用。
 * クライアントに公開されるため、内部情報（tx 等）は含まない。
 */
export type PersistedMilestoneResult = {
  /** マイルストーンキー */
  milestoneKey: string;
  /** 達成したかどうか */
  achieved: boolean;
  /** onAchieved の戻り値（報酬情報等） */
  metadata?: Record<string, unknown>;
};
