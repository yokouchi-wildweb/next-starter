// src/features/core/analytics/services/server/walletStateAnalytics.ts
// ウォレット現在状態（state）ベースの集計サービス
// データソース: wallets テーブル（履歴ではなく現時点の保有状態のスナップショット）
// 対比: walletRankingAnalytics.ts（wallet_histories ベースの増減量集計）
// 全ての集計処理はDB側 GROUP BY + 集約関数で実行する

import { db } from "@/lib/drizzle";
import { WalletTable } from "@/features/core/wallet/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type {
  RankingResponse,
  PaginationParams,
  UserFilter,
} from "@/features/core/analytics/types/common";
import {
  DEFAULT_RANKING_LIMIT,
  MAX_RANKING_LIMIT,
} from "@/features/core/analytics/constants";
import type { WalletType } from "@/config/app/currency.config";
import { buildUserFilterConditions } from "./utils/userFilter";
import { buildBucketExpr } from "./utils/distribution";

// ============================================================================
// 共通パラメータ型
// ============================================================================

/** ウォレット種別必須フィルタ（state 系は通貨単位が異なるため type ごとに集計する） */
export type RequiredWalletTypeFilter = {
  walletType: WalletType;
};

// ============================================================================
// サマリー
// ============================================================================

export type WalletStateSummary = {
  walletType: WalletType;
  /** 全ウォレットの利用可能残高合計 */
  totalBalance: number;
  /** 全ウォレットのロック残高合計（参考値） */
  totalLockedBalance: number;
  /** balance > 0 のユーザー数（保有者） */
  holderCount: number;
  /** ウォレットレコード総数（type に対する全ユーザー） */
  walletCount: number;
  /** 保有者の平均残高 */
  averageBalance: number;
  /** 保有者の中央値残高 */
  medianBalance: number;
  /** 最大残高 */
  maxBalance: number;
};

export type WalletStateSummaryParams = RequiredWalletTypeFilter & UserFilter;

const w = WalletTable;
const u = UserTable;

export async function getWalletStateSummary(
  params: WalletStateSummaryParams,
): Promise<WalletStateSummary> {
  const conditions = buildBaseConditions(params);

  const rows = await db
    .select({
      totalBalance: sql<number>`COALESCE(SUM(${w.balance}), 0)`.as("total_balance"),
      totalLockedBalance: sql<number>`COALESCE(SUM(${w.locked_balance}), 0)`.as(
        "total_locked_balance",
      ),
      holderCount:
        sql<number>`COUNT(*) FILTER (WHERE ${w.balance} > 0)::int`.as(
          "holder_count",
        ),
      walletCount: sql<number>`COUNT(*)::int`.as("wallet_count"),
      averageBalance:
        sql<number>`COALESCE(AVG(${w.balance}) FILTER (WHERE ${w.balance} > 0), 0)`.as(
          "average_balance",
        ),
      medianBalance:
        sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${w.balance}) FILTER (WHERE ${w.balance} > 0), 0)`.as(
          "median_balance",
        ),
      maxBalance: sql<number>`COALESCE(MAX(${w.balance}), 0)`.as("max_balance"),
    })
    .from(w)
    .where(and(...conditions));

  const r = rows[0]!;
  return {
    walletType: params.walletType,
    totalBalance: Number(r.totalBalance),
    totalLockedBalance: Number(r.totalLockedBalance),
    holderCount: Number(r.holderCount),
    walletCount: Number(r.walletCount),
    averageBalance: Number(r.averageBalance),
    medianBalance: Number(r.medianBalance),
    maxBalance: Number(r.maxBalance),
  };
}

// ============================================================================
// ランキング（現在保有量ベース）
// ============================================================================

export type WalletStateRankingSortBy = "balance" | "lockedBalance" | "totalBalance";

const VALID_RANKING_SORT_BY: WalletStateRankingSortBy[] = [
  "balance",
  "lockedBalance",
  "totalBalance",
];

export function parseWalletStateRankingSortBy(
  raw: string | null,
): WalletStateRankingSortBy | undefined {
  if (raw && VALID_RANKING_SORT_BY.includes(raw as WalletStateRankingSortBy)) {
    return raw as WalletStateRankingSortBy;
  }
  return undefined;
}

type WalletStateRankingEntry = {
  userId: string;
  displayName: string | null;
  balance: number;
  lockedBalance: number;
  updatedAt: string | null;
};

export type WalletStateRankingParams = RequiredWalletTypeFilter &
  PaginationParams &
  UserFilter & {
    sortBy?: WalletStateRankingSortBy;
  };

/** ソート指標に対応する SQL 式 */
function resolveRankingSortExpr(sortBy: WalletStateRankingSortBy): SQL {
  switch (sortBy) {
    case "balance":
      return sql`${w.balance} DESC`;
    case "lockedBalance":
      return sql`${w.locked_balance} DESC`;
    case "totalBalance":
      return sql`(${w.balance} + ${w.locked_balance}) DESC`;
  }
}

export async function getWalletStateRanking(
  params: WalletStateRankingParams,
): Promise<RankingResponse<WalletStateRankingEntry> & { walletType: WalletType }> {
  const sortBy = params.sortBy ?? "balance";
  const limit = Math.min(
    Math.max(params.limit ?? DEFAULT_RANKING_LIMIT, 1),
    MAX_RANKING_LIMIT,
  );
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  // 0残高ユーザーは「保有者ランキング」の対象外
  const conditions = [...buildBaseConditions(params), sql`${w.balance} > 0`];

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        userId: w.user_id,
        displayName: u.name,
        balance: w.balance,
        lockedBalance: w.locked_balance,
        updatedAt: sql<string | null>`${w.updatedAt}::text`.as("updated_at"),
      })
      .from(w)
      .leftJoin(u, eq(w.user_id, u.id))
      .where(and(...conditions))
      .orderBy(resolveRankingSortExpr(sortBy))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`COUNT(*)::int`.as("total") })
      .from(w)
      .where(and(...conditions)),
  ]);

  const totalRow = totalRows[0]!;

  return {
    walletType: params.walletType,
    items: rows.map((r, idx) => ({
      rank: offset + idx + 1,
      userId: r.userId,
      displayName: r.displayName ?? null,
      balance: Number(r.balance),
      lockedBalance: Number(r.lockedBalance),
      updatedAt: r.updatedAt ?? null,
    })),
    total: Number(totalRow.total),
  };
}

// ============================================================================
// 分布（現在保有量レンジ別）
// ============================================================================

type WalletStateDistributionGroup = {
  /** バケットの下限（balance >= min） */
  min: number;
  /** バケットの上限（最上位グループは null。それ以外は次境界 - 1） */
  max: number | null;
  /** バケット内のユーザー数 */
  userCount: number;
  /** バケット内の合計残高 */
  totalBalance: number;
  /** 保有者総数に対する割合（%、小数2桁） */
  percentage: number;
  /** 保有者総残高に対する割合（%、小数2桁） */
  balancePercentage: number;
};

export type WalletStateDistribution = {
  walletType: WalletType;
  /** 保有者総数（balance > 0 のユーザー数） */
  totalHolders: number;
  /** 保有者の合計残高 */
  totalBalance: number;
  /** 0 残高ウォレット数（保有しているがゼロのレコード） */
  zeroBalanceCount: number;
  groups: WalletStateDistributionGroup[];
};

export type WalletStateDistributionParams = RequiredWalletTypeFilter &
  UserFilter & {
    boundaries: number[];
  };

export async function getWalletStateDistribution(
  params: WalletStateDistributionParams,
): Promise<WalletStateDistribution> {
  const { boundaries } = params;
  const baseConditions = buildBaseConditions(params);

  // 保有者のみをバケット振り分け対象とする
  const holderConditions = [...baseConditions, sql`${w.balance} > 0`];
  const bucketExpr = buildBucketExpr(sql<number>`${w.balance}`, boundaries);

  // 単一クエリで全バケット集計
  const bucketRowsPromise = db
    .select({
      bucketMin: bucketExpr.as("bucket_min"),
      userCount: sql<number>`COUNT(*)::int`.as("user_count"),
      totalBalance: sql<number>`COALESCE(SUM(${w.balance}), 0)`.as("group_total"),
    })
    .from(w)
    .where(and(...holderConditions))
    .groupBy(sql`bucket_min`)
    .orderBy(sql`bucket_min ASC`);

  // ゼロ残高ユーザー数（distribution の対象外として別カウント）
  const zeroRowsPromise = db
    .select({
      count: sql<number>`COUNT(*)::int`.as("count"),
    })
    .from(w)
    .where(and(...baseConditions, eq(w.balance, 0)));

  const [bucketRows, zeroRows] = await Promise.all([
    bucketRowsPromise,
    zeroRowsPromise,
  ]);

  const totalHolders = bucketRows.reduce(
    (sum, r) => sum + Number(r.userCount),
    0,
  );
  const totalBalance = bucketRows.reduce(
    (sum, r) => sum + Number(r.totalBalance),
    0,
  );

  // 全バケットを構築（データなしバケットも 0 件として返す）
  const allBucketMins = [0, ...boundaries];
  const resultMap = new Map(bucketRows.map((r) => [Number(r.bucketMin), r]));

  const groups: WalletStateDistributionGroup[] = allBucketMins.map((min, idx) => {
    const max =
      idx < allBucketMins.length - 1 ? allBucketMins[idx + 1] - 1 : null;
    const row = resultMap.get(min);
    const userCount = row ? Number(row.userCount) : 0;
    const groupBalance = row ? Number(row.totalBalance) : 0;

    return {
      min,
      max,
      userCount,
      totalBalance: groupBalance,
      percentage:
        totalHolders > 0
          ? Math.round((userCount / totalHolders) * 10000) / 100
          : 0,
      balancePercentage:
        totalBalance > 0
          ? Math.round((groupBalance / totalBalance) * 10000) / 100
          : 0,
    };
  });

  return {
    walletType: params.walletType,
    totalHolders,
    totalBalance,
    zeroBalanceCount: Number(zeroRows[0]?.count ?? 0),
    groups,
  };
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

/** walletType + ユーザーフィルタの共通条件 */
function buildBaseConditions(
  params: RequiredWalletTypeFilter & UserFilter,
): SQL[] {
  return [
    eq(w.type, params.walletType),
    ...buildUserFilterConditions(w.user_id, params),
  ];
}
