// src/features/core/analytics/services/server/coinIssuance/index.ts
// 統合コイン創出サマリーの aggregator。
//
// レジストリに登録された全 CoinIssuanceSource を並列実行し、
// kind に応じて加算 / 減算して finalProfit を算出する。
//
// 設計方針:
//  - 各ソースは「期間 + UserFilter を受け取り {current, previous} を返す」
//    という単一インターフェイスのみを満たす。集計ロジックはソース側に閉じる
//  - 当期と前期を 1 クエリで返す責務は各ソースに委譲 (CASE WHEN 等)
//  - aggregator は kind による符号反転と Σ 計算、レスポンス整形のみを行う
//
// downstream 拡張:
//  - src/registry/coinIssuanceRegistry.ts に新 source を追加するだけで
//    レスポンスの sources にそのキーが自動で追加される

import { coinIssuanceSources } from "@/registry/coinIssuanceRegistry";

import type {
  DateRangeParams,
  UserFilter,
} from "@/features/core/analytics/types/common";
import { resolveDateRange, formatDateRangeForResponse } from "../utils/dateRange";
import { changeRate } from "../utils/aggregation";
import type {
  CoinIssuanceSource,
  CoinIssuanceSourceEntry,
  CoinIssuanceSummaryData,
} from "./types";

export type CoinIssuanceSummaryParams = DateRangeParams & UserFilter;

/**
 * 統合コイン創出サマリーを集計する。
 *
 * - レジストリに登録された全ソースを並列実行
 * - revenue は finalProfit に加算、issuance は減算
 * - 前期比較は各ソースの previous 値を同じルールで集計
 */
export async function getCoinIssuanceSummary(
  params: CoinIssuanceSummaryParams,
): Promise<CoinIssuanceSummaryData> {
  const range = resolveDateRange(params);

  // 前期の日付範囲 (既存 summary 系と同じ計算ロジック)
  const prevDateFrom = new Date(range.dateFrom);
  prevDateFrom.setDate(prevDateFrom.getDate() - range.dayCount);
  const prevDateTo = new Date(range.dateFrom);
  prevDateTo.setMilliseconds(prevDateTo.getMilliseconds() - 1);
  const prevRange = { dateFrom: prevDateFrom, dateTo: prevDateTo };

  const userFilter: UserFilter = {
    ...(params.roles && { roles: params.roles }),
    ...(params.excludeDemo && { excludeDemo: params.excludeDemo }),
  };

  // 全ソースを並列実行
  const results = await Promise.all(
    coinIssuanceSources.map(async (source) => ({
      source,
      result: await source.aggregate({ range, prevRange, userFilter }),
    })),
  );

  // sources レコードと合計値を組み立てる
  const sources: Record<string, CoinIssuanceSourceEntry> = {};
  let totalRevenue = 0;
  let totalIssuance = 0;
  let prevTotalRevenue = 0;
  let prevTotalIssuance = 0;

  for (const { source, result } of results) {
    sources[source.key] = {
      kind: source.kind,
      current: result.current,
      previous: result.previous,
      changeRate: changeRate(result.current, result.previous),
    };

    if (source.kind === "revenue") {
      totalRevenue += result.current;
      prevTotalRevenue += result.previous;
    } else {
      totalIssuance += result.current;
      prevTotalIssuance += result.previous;
    }
  }

  const finalProfit = totalRevenue - totalIssuance;
  const prevFinalProfit = prevTotalRevenue - prevTotalIssuance;

  // granularity は summary API では意味を持たないので dateFrom/dateTo のみ抽出
  const { dateFrom, dateTo } = formatDateRangeForResponse(range);

  return {
    dateFrom,
    dateTo,
    sources,
    totalRevenue,
    totalIssuance,
    finalProfit,
    comparison: {
      previousPeriod: {
        totalRevenue: prevTotalRevenue,
        totalIssuance: prevTotalIssuance,
        finalProfit: prevFinalProfit,
        changeRate: {
          totalRevenue: changeRate(totalRevenue, prevTotalRevenue),
          totalIssuance: changeRate(totalIssuance, prevTotalIssuance),
          finalProfit: changeRate(finalProfit, prevFinalProfit),
        },
      },
    },
  };
}

// 主要 export を 1 箇所に集約
export type {
  CoinIssuanceSource,
  CoinIssuanceSourceContext,
  CoinIssuanceSourceResult,
  CoinIssuanceSourceEntry,
  CoinIssuanceSummaryData,
  PreviousRange,
} from "./types";
