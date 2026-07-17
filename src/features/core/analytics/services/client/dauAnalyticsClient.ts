// src/features/core/analytics/services/client/dauAnalyticsClient.ts
// DAU 集計系 analytics（daily / summary / ranking / active-days-histogram）の HTTP クライアント
// ※ DAU の記録（ingest）は dauClient.ts / useDauTracker を使用する

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";
import type {
  DauDailyData,
  DauSummaryData,
  DauRankingEntry,
  DauActiveDaysHistogramResponse,
} from "@/features/core/analytics/services/server/dauAnalytics";
import type {
  DailyAnalyticsResponse,
  Granularity,
  PeriodSummaryResponse,
  RankingResponse,
} from "@/features/core/analytics/types/common";

const BASE_PATH = "/api/admin/analytics/dau";

/** 日付範囲 + ユーザー属性フィルタ（DAU 系 API 共通） */
export type DauAnalyticsClientBaseParams = {
  /** 日数指定 (dateFrom/dateTo より低優先) */
  days?: number;
  /** 開始日 (YYYY-MM-DD) */
  dateFrom?: string;
  /** 終了日 (YYYY-MM-DD) */
  dateTo?: string;
  /** タイムゾーン (IANA TZ 名) */
  timezone?: string;
  /** 含めるロール (CSV) */
  roles?: string;
  /** デモユーザーを除外 */
  excludeDemo?: boolean;
};

// ============================================================================
// daily
// ============================================================================

export type DauDailyClientParams = DauAnalyticsClientBaseParams & {
  /** 集計粒度 (day=DAU / week=WAU / month=MAU。hour 不可) */
  granularity?: Granularity;
  /** 単一ユーザーへのドリルダウン（day 粒度で 0/1 系列） */
  userId?: string;
};

export async function fetchDauDaily(
  params?: DauDailyClientParams,
): Promise<DailyAnalyticsResponse<DauDailyData>> {
  try {
    const { data } = await axios.get<DailyAnalyticsResponse<DauDailyData>>(
      `${BASE_PATH}/daily`,
      { params },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "DAU集計の取得に失敗しました");
  }
}

// ============================================================================
// summary
// ============================================================================

export type DauSummaryClientParams = DauDailyClientParams;

export async function fetchDauSummary(
  params?: DauSummaryClientParams,
): Promise<PeriodSummaryResponse<DauSummaryData>> {
  try {
    const { data } = await axios.get<PeriodSummaryResponse<DauSummaryData>>(
      `${BASE_PATH}/summary`,
      { params },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "DAUサマリーの取得に失敗しました");
  }
}

// ============================================================================
// ranking
// ============================================================================

export type DauRankingClientParams = DauAnalyticsClientBaseParams & {
  /** 1ページあたりの件数（デフォルト 50、最大 200） */
  limit?: number;
  /** ページ番号（1 始まり） */
  page?: number;
};

export async function fetchDauRanking(
  params?: DauRankingClientParams,
): Promise<RankingResponse<DauRankingEntry>> {
  try {
    const { data } = await axios.get<RankingResponse<DauRankingEntry>>(
      `${BASE_PATH}/ranking`,
      { params },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "アクティブ日数ランキングの取得に失敗しました");
  }
}

// ============================================================================
// active-days-histogram
// ============================================================================

export type DauActiveDaysHistogramClientParams = DauAnalyticsClientBaseParams;

export async function fetchDauActiveDaysHistogram(
  params?: DauActiveDaysHistogramClientParams,
): Promise<DauActiveDaysHistogramResponse> {
  try {
    const { data } = await axios.get<DauActiveDaysHistogramResponse>(
      `${BASE_PATH}/active-days-histogram`,
      { params },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "アクティブ日数ヒストグラムの取得に失敗しました");
  }
}
