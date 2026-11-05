// src/features/core/analytics/services/server/exclusion/types.ts
// 分析の除外条件のプロバイダの型(項目: analytics/exclusionProviders/<名前>.ts の export const provider、一覧は生成物)。
//
// 上流は口だけを持ち、除外の表と条件は fork が持つ(上流の項目は 0)。core の表に列や部分 index は足さず、
// fork の衛星表(例: analytics_excluded_rows(source, row_id, exclusion_id))と行の id で突き合わせる。
// 集計の性質ごとに呼び手が scope を渡す:
// - flow: 期間の事実の行(収支・購入・プレイ数など)。除外した行だけを落とす
// - stock: 残高・流通量など人ごとの状態。期間外の残高にも残るので、除外した人を丸ごと落とす
// 実行時機: 各集計のクエリを組み立てるとき(同期、読みだけ、tx なし)。項目の throw はその集計の 500。
// 詳細: src/features/core/analytics/README.md「分析の除外条件」

import type { Column, SQL } from "drizzle-orm";

/**
 * 事実の表の名前(上流の集計が flow で渡す値)。fork の集計は自分の表の名前を文字列で渡してよい
 */
export type AnalyticsExclusionSource =
  | "wallet_histories"
  | "purchase_requests"
  | "user_daily_activities"
  | "coupon_attribution_rewards"
  | (string & {});

/** 集計の性質(buildUserFilterConditions / buildExclusionConditions の第 3 引数) */
export type AnalyticsExclusionScope =
  | {
      kind: "flow";
      /** 事実の表の名前 */
      source: AnalyticsExclusionSource;
      /** 事実の表の行 id の列(衛星表の row_id と突き合わせる) */
      rowId: Column;
    }
  | { kind: "stock" };

/** flow の項目に渡す値 */
export type AnalyticsExclusionFlowContext = {
  source: AnalyticsExclusionSource;
  rowId: Column;
  /** 事実の表の利用者の列 */
  userId: Column;
};

/** stock の項目に渡す値 */
export type AnalyticsExclusionStockContext = {
  /** 集計の利用者の列(受取人・invitee のこともある) */
  userId: Column;
};

/**
 * 除外条件のプロバイダ(1 項目)。返した SQL は「残す行」の条件(例: NOT EXISTS (…))で、AND で足される。
 * その集計に関係なければ undefined を返す(例: 扱わない source)
 */
export type AnalyticsExclusionProvider = {
  /** 一意のキー(重複は一覧の読み込み時に例外) */
  key: string;
  /** 機能が閉じている間は足さない(fork の除外の表が無いことがある。省略 = 常に) */
  enabled?: () => boolean;
  /** flow: 期間の事実の行を落とす条件 */
  flow?: (ctx: AnalyticsExclusionFlowContext) => SQL | undefined;
  /** stock: 人を丸ごと落とす条件 */
  stock?: (ctx: AnalyticsExclusionStockContext) => SQL | undefined;
};
