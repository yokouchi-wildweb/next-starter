// src/features/core/analytics/services/client/coinIssuanceClient.ts
// 統合コイン創出サマリー API の HTTP クライアント

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";
import type { CoinIssuanceSummaryData } from "@/features/core/analytics/services/server/coinIssuance";

const BASE_PATH = "/api/admin/analytics/coin-issuance";

export type CoinIssuanceSummaryClientParams = {
  /** 日数指定 (dateFrom/dateTo より低優先) */
  days?: number;
  /** 開始日 (YYYY-MM-DD or ISO) */
  dateFrom?: string;
  /** 終了日 (YYYY-MM-DD or ISO) */
  dateTo?: string;
  /** タイムゾーン (IANA TZ 名) */
  timezone?: string;
  /** 含めるロール (CSV) */
  roles?: string;
  /** デモユーザーを除外 */
  excludeDemo?: boolean;
};

export async function fetchCoinIssuanceSummary(
  params?: CoinIssuanceSummaryClientParams,
): Promise<CoinIssuanceSummaryData> {
  try {
    const { data } = await axios.get<CoinIssuanceSummaryData>(
      `${BASE_PATH}/summary`,
      { params },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "コイン創出サマリーの取得に失敗しました");
  }
}
