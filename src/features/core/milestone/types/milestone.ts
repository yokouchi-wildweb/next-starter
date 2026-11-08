// マイルストーンフレームワークの型定義
//
// ベースリポジトリではフレームワークのみ提供。
// 下流プロジェクトが services/server/definitions/<名前>.ts に具体的なマイルストーンを登録する。

import type { TransactionClient } from "@/lib/drizzle";

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
  /**
   * この評価(1 回の evaluateMilestones)で先に達成した鍵。後に評価する定義・段階が前の達成を見るのに使う。
   * エンジンが渡す(呼び出し元は渡さない)。評価の外から呼んだときは undefined
   */
  achievedInThisEvaluation?: ReadonlySet<string>;
};

/**
 * onAchieved コールバックに渡されるパラメータ
 */
export type MilestoneAchievedParams = {
  userId: string;
  milestoneKey: string;
  context: MilestoneEventContext;
  /** 達成の記録と同じトランザクション(エンジンは記録を確定してから onAchieved を呼ぶ。呼び出しに tx が無くても渡す) */
  tx?: TransactionClient;
  /**
   * シリーズの段階のとき: どの段階で達成したか。sequential で上の段が達成したために下の段を達成させたときは
   * viaHigherStage が true(reachedStageKey = その評価で達成した一番上の段)。付与を省くかは項目が決める
   */
  series?: MilestoneSeriesMarker & { reachedStageKey: string; viaHigherStage: boolean };
};

/**
 * マイルストーン定義
 *
 * 下流プロジェクトでの使い方:
 * ```ts
 * export const milestone: MilestoneDefinition = {
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
  /**
   * シリーズの段階から展開された定義の印(読み手が付ける。項目のファイルには書かない)。
   * 普通の定義では undefined
   */
  series?: MilestoneSeriesMarker;
};

/**
 * シリーズの評価の順
 * - "sequential": 段階の並び順に評価する(ランクのように下の段から上がる物)
 * - "unordered": 段階どうしに順が無い(解放の一覧など)。並びは評価の順に意味を持たない
 */
export type MilestoneSeriesOrder = "sequential" | "unordered";

/** 展開した段階の定義に付く印 */
export type MilestoneSeriesMarker = {
  /** シリーズの鍵(項目の key) */
  seriesKey: string;
  /** 段階の達成の鍵(= 展開した定義の key) */
  stageKey: string;
  /** stages() の中の位置(0 始まり、評価のその時の並び) */
  index: number;
  order: MilestoneSeriesOrder;
};

/**
 * 段階のあるシリーズ(受け口 definitions の 1 項目で、段階ごとの達成を持つ)。
 * 読み手が評価のたびに stages() を呼び、段階ごとの MilestoneDefinition に展開する。
 *
 * - stages: 段階の一覧を返す関数。評価のたびに呼ぶ(config・setting から読める)。並びがその時の評価の順
 * - stageKey: 段階 → 達成の鍵(永続化される。milestones.milestone_key)。段階の名前から作り、並びの番号では作らない
 *   (段階を足す・並べ替えると番号は変わり、記録済みの達成と合わなくなる)
 * - evaluate / onAchieved: 段階を受け取る共通の関数。値(閾値・報酬・文言)は段階の行に持つ
 *
 * ```ts
 * export const milestone = defineMilestoneSeries({
 *   kind: "series",
 *   key: "rank_up",
 *   triggers: ["purchase_completed"],
 *   order: "sequential",
 *   stages: () => getRankTiers(),               // [{ key: "bronze", threshold: 3000, bonus: 100 }, …]
 *   stageKey: (tier) => `rank_${tier.key}`,     // 記録済みの鍵と同じ形
 *   evaluate: async (tier, { userId }, tx) => (await totalPurchased(userId, tx)) >= tier.threshold,
 *   onAchieved: async (tier, { userId, tx }) => grantBonus(userId, tier.bonus, tx),
 * });
 * ```
 */
export type MilestoneSeries<S = unknown> = {
  kind: "series";
  /** シリーズの鍵(他のマイルストーン・段階の鍵と重ならない) */
  key: string;
  /** どのイベントで評価するか(段階のすべてに共通) */
  triggers: string[];
  order: MilestoneSeriesOrder;
  /** 段階の一覧(評価のたびに呼ぶ) */
  stages: () => readonly S[];
  /** 段階 → 達成の鍵(段階の名前から作る) */
  stageKey: (stage: S) => string;
  /** 段階の達成条件 */
  evaluate: (stage: S, context: MilestoneEventContext, tx?: TransactionClient) => Promise<boolean>;
  /** 段階の達成時のコールバック。戻り値は metadata として保存される */
  onAchieved?: (stage: S, params: MilestoneAchievedParams) => Promise<Record<string, unknown> | void>;
};

/** 受け口 definitions の 1 項目: 普通の定義か段階のあるシリーズ */
export type MilestoneItem = MilestoneDefinition | MilestoneSeries<any>;

/** シリーズの段階の型を推すための恒等関数(項目のファイルで使う) */
export function defineMilestoneSeries<S>(series: MilestoneSeries<S>): MilestoneSeries<S> {
  return series;
}

export function isMilestoneSeries(item: MilestoneItem): item is MilestoneSeries<unknown> {
  return (item as { kind?: unknown }).kind === "series";
}

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
