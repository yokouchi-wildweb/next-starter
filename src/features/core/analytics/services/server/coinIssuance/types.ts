// src/features/core/analytics/services/server/coinIssuance/types.ts
// コイン創出サマリーの拡張可能フレームワーク型定義
//
// 設計方針:
//  - サービス全体のコイン収支 (finalProfit) を 1 API に統一する。
//  - 個別の集計ロジックは「コイン創出ソース (CoinIssuanceSource)」として
//    レジストリに登録する形にし、upstream / downstream の双方が
//    自分の管理するドメインからソースを追加できるようにする。
//  - 各ソースは「期間 + UserFilter を受け取り、当期と前期の合計値を返す」
//    という共通インターフェイスのみを実装すればよく、内部のクエリ構造や
//    参照テーブルはソース実装の自由とする。
//
// 拡張方法:
//  1. CoinIssuanceSource を満たす値を作る (sources/ 配下に追加)
//  2. src/registry/coinIssuanceRegistry.ts の配列に追加する
//  3. (任意) labels.ts の registerCoinIssuanceLabels で表示名を登録する
//
// 集計の符号規約:
//  - kind: "revenue"   = 収入 (プラス)。finalProfit に加算される
//  - kind: "issuance"  = 発行 (マイナス)。finalProfit から減算される
//  - 各ソースが返す current / previous は「絶対値 (正の数)」で返す。
//    符号反転は aggregator が kind を見て行うため、ソース側は気にしなくてよい。

import type { SQL } from "drizzle-orm";
import type {
  ResolvedDateRange,
  UserFilter,
} from "@/features/core/analytics/types/common";

// ============================================================================
// ソース実装側の型
// ============================================================================

/**
 * 前期 (= 当期と同じ長さ・直前の連続期間) の日付範囲。
 *
 * 既存 summary 系と同じ計算ロジック:
 *   prevDateFrom = range.dateFrom - dayCount 日
 *   prevDateTo   = range.dateFrom - 1ms
 *
 * 値は aggregator 側で計算してから ctx に詰めて渡すので、
 * 各ソースは独自に再計算しなくてよい (前期計算の食い違いを防ぐ)。
 */
export type PreviousRange = {
  dateFrom: Date;
  dateTo: Date;
};

/**
 * ソースの aggregate() に渡されるコンテキスト。
 */
export type CoinIssuanceSourceContext = {
  /** 解決済みの当期日付範囲 (granularity / timezone を含む) */
  range: ResolvedDateRange;
  /** 前期の日付範囲 (aggregator が計算済み) */
  prevRange: PreviousRange;
  /** ユーザー属性フィルタ (roles / excludeDemo)。ソース側が独自に適用する */
  userFilter: UserFilter;
};

/**
 * ソースが返す集計結果。
 *
 * - current  : 当期の合計値 (絶対値)
 * - previous : 前期の合計値 (絶対値)
 *
 * パフォーマンス上の理由から、内部実装は当期+前期を CASE WHEN で
 * 1 クエリにまとめることを推奨 (既存 summary 系と同じパターン)。
 */
export type CoinIssuanceSourceResult = {
  current: number;
  previous: number;
};

/**
 * コイン創出ソースの 1 単位。
 *
 * 1 ソース = 「あるドメインがコイン収支に与える 1 種類の寄与」。
 * 例: クーポンによる発行ギャップ, 紹介リワード付与, ガチャ売上, etc.
 */
export type CoinIssuanceSource = {
  /**
   * レジストリ内の一意キー。レスポンス JSON のキーとしてそのまま使うため
   * snake_case を推奨 (例: "purchase_bonus_gap", "referral_reward").
   *
   * 同一キーを 2 つ登録するとレジストリ初期化時にエラーになる。
   */
  key: string;

  /**
   * 寄与の方向。
   * - "revenue"  : 収入。finalProfit に加算される (ガチャ売上等)
   * - "issuance" : 発行 (= サービス側の費用)。finalProfit から減算される
   *                (クーポンボーナス / 紹介リワード等)
   */
  kind: "revenue" | "issuance";

  /**
   * 期間集計を実行して当期と前期の合計値を返す。
   *
   * 実装ガイド:
   *  - 当期+前期は CASE WHEN で 1 クエリにまとめる (Promise.all より速い)
   *  - 戻り値は常に「絶対値 (正の数)」とする。kind による符号反転は aggregator
   *    の責務なので、ソース側は気にしなくてよい
   *  - UserFilter (ctx.userFilter) は対象テーブルの user_id カラムに対して
   *    buildUserFilterConditions で適用する。適用が意味を持たないソース
   *    (e.g. 既存 referralAnalytics の rewardTotal) は適用しなくてよい
   */
  aggregate: (ctx: CoinIssuanceSourceContext) => Promise<CoinIssuanceSourceResult>;
};

// ============================================================================
// API レスポンスの型
// ============================================================================

/**
 * 1 ソース分のレスポンスエントリ。
 */
export type CoinIssuanceSourceEntry = {
  /** "revenue" or "issuance"。UI 側の符号表現に使う */
  kind: "revenue" | "issuance";
  /** 当期の合計値 (絶対値) */
  current: number;
  /** 前期の合計値 (絶対値) */
  previous: number;
  /** 前期比変化率。previous=0 のときの規約は utils/aggregation.ts changeRate を参照 */
  changeRate: number | null;
};

/**
 * GET /api/admin/analytics/coin-issuance/summary のレスポンス。
 *
 * sources は動的キー (レジストリで定義されたソース key) の Record。
 * downstream がソースを追加しても upstream の型は無変更で済む。
 */
export type CoinIssuanceSummaryData = {
  /** 期間開始日 (YYYY-MM-DD) */
  dateFrom: string;
  /** 期間終了日 (YYYY-MM-DD) */
  dateTo: string;

  /** ソース別の内訳 (動的キー) */
  sources: Record<string, CoinIssuanceSourceEntry>;

  /** Σ revenue.current */
  totalRevenue: number;
  /** Σ issuance.current */
  totalIssuance: number;
  /** finalProfit = totalRevenue - totalIssuance */
  finalProfit: number;

  comparison: {
    previousPeriod: {
      totalRevenue: number;
      totalIssuance: number;
      finalProfit: number;
      changeRate: {
        totalRevenue: number | null;
        totalIssuance: number | null;
        finalProfit: number | null;
      };
    };
  };
};

// ============================================================================
// 共通ヘルパー型 (再 export)
// ============================================================================

/**
 * SQL 注入式の型 (referralReward source 等で reward 金額抽出式を差し替える用途).
 * downstream が呼び出し側で使えるよう再 export している。
 */
export type CoinIssuanceAmountExpr = SQL<number>;
