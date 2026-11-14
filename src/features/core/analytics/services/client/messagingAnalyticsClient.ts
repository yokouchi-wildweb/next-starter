// src/features/core/analytics/services/client/messagingAnalyticsClient.ts
// 連絡(messaging)の集計の HTTP クライアント(GET /api/admin/analytics/messaging/{summary, series, breakdown, dispatches}、管理者だけ)
// - 絞り: 期間(days / dateFrom / dateTo / timezone / granularity / alignToGranularity)と channel / messageKey / category。省略 = 送らない
// - 型はサーバーの集計の型(type だけ読む)

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";
import type {
  MessagingAnalyticsParams,
  MessagingBreakdownAxis,
  MessagingBreakdownResponse,
  MessagingDispatchesResponse,
  MessagingSeriesResponse,
  MessagingSummaryResponse,
} from "@/features/core/analytics/services/server/messagingAnalytics";

const BASE_PATH = "/api/admin/analytics/messaging";

/** 期間と絞り(どれも省略可) */
export type MessagingAnalyticsClientParams = MessagingAnalyticsParams;

export type MessagingDispatchesClientParams = MessagingAnalyticsClientParams & {
  /** 続きの位置(直前の応答の nextCursor。null・省略 = 先頭) */
  cursor?: string | null;
  /** 1 回の件数(1-100、既定 20) */
  limit?: number;
};

/** undefined・null・空文字を落とした query(axios に渡す) */
function queryOf(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query[key] = value as string | number | boolean;
  }
  return query;
}

export async function fetchMessagingSummary(
  params: MessagingAnalyticsClientParams = {},
): Promise<MessagingSummaryResponse> {
  try {
    const { data } = await axios.get<MessagingSummaryResponse>(`${BASE_PATH}/summary`, { params: queryOf(params) });
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "連絡の集計の取得に失敗しました");
  }
}

export async function fetchMessagingSeries(
  params: MessagingAnalyticsClientParams = {},
): Promise<MessagingSeriesResponse> {
  try {
    const { data } = await axios.get<MessagingSeriesResponse>(`${BASE_PATH}/series`, { params: queryOf(params) });
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "連絡の集計の推移の取得に失敗しました");
  }
}

export async function fetchMessagingBreakdown(
  axis: MessagingBreakdownAxis,
  params: MessagingAnalyticsClientParams = {},
): Promise<MessagingBreakdownResponse> {
  try {
    const { data } = await axios.get<MessagingBreakdownResponse>(`${BASE_PATH}/breakdown`, {
      params: queryOf({ ...params, axis }),
    });
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "連絡の集計の内訳の取得に失敗しました");
  }
}

export async function fetchMessagingDispatches(
  params: MessagingDispatchesClientParams = {},
): Promise<MessagingDispatchesResponse> {
  try {
    const { data } = await axios.get<MessagingDispatchesResponse>(`${BASE_PATH}/dispatches`, {
      params: queryOf(params),
    });
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "連絡の集計の回ごとの取得に失敗しました");
  }
}
