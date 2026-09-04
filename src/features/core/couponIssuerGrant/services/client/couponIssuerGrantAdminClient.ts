"use client";

// src/features/core/couponIssuerGrant/services/client/couponIssuerGrantAdminClient.ts
//
// 管理者向けリードモデルのクライアントサービス（一覧+統計 / 詳細統計 / 利用履歴 / 報酬履歴）。

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { SortState } from "@/lib/tableSuite";
import type { CouponIssuerGrantStatus } from "@/features/core/couponIssuerGrant/constants";
import type {
  GetGrantListWithStatsResult,
  GrantWithStats,
  IssuerRewardHistoryItem,
  IssuerUsageHistoryItem,
} from "@/features/core/couponIssuerGrant/services/server/stats";

const BASE = "/api/admin/coupon-issuer-grants";

export type GrantListWithStatsQuery = {
  status?: CouponIssuerGrantStatus | CouponIssuerGrantStatus[];
  searchQuery?: string;
  page?: number;
  limit?: number;
  sort?: SortState;
};

/** 発行権一覧 + 統計 */
export async function fetchGrantListWithStats(
  query: GrantListWithStatsQuery = {},
): Promise<GetGrantListWithStatsResult> {
  try {
    const res = await axios.get<GetGrantListWithStatsResult>(BASE, {
      params: {
        status: Array.isArray(query.status) ? query.status.join(",") : query.status,
        searchQuery: query.searchQuery || undefined,
        page: query.page,
        limit: query.limit,
        sortField: query.sort?.field,
        sortDirection: query.sort?.direction,
      },
    });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "発行権一覧の取得に失敗しました");
  }
}

/** 発行権 1 件の統計 */
export async function fetchGrantStats(grantId: string): Promise<GrantWithStats> {
  try {
    const res = await axios.get<GrantWithStats>(`${BASE}/${encodeURIComponent(grantId)}/stats`);
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "統計の取得に失敗しました");
  }
}

/** 発行者の利用履歴（ページング） */
export async function fetchIssuerUsageHistory(
  grantId: string,
  params: { page?: number; limit?: number } = {},
): Promise<{ items: IssuerUsageHistoryItem[]; total: number }> {
  try {
    const res = await axios.get<{ items: IssuerUsageHistoryItem[]; total: number }>(
      `${BASE}/${encodeURIComponent(grantId)}/usage-history`,
      { params },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "利用履歴の取得に失敗しました");
  }
}

/** 発行者の報酬履歴（ページング） */
export async function fetchIssuerRewardHistory(
  grantId: string,
  params: { page?: number; limit?: number } = {},
): Promise<{ items: IssuerRewardHistoryItem[]; total: number }> {
  try {
    const res = await axios.get<{ items: IssuerRewardHistoryItem[]; total: number }>(
      `${BASE}/${encodeURIComponent(grantId)}/reward-history`,
      { params },
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "報酬履歴の取得に失敗しました");
  }
}
