// src/features/core/analytics/services/client/walletStateAnalyticsClient.ts
// ウォレット現在状態（state）系 analytics の HTTP クライアント

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";
import type { WalletType } from "@/config/app/currency.config";
import type {
  WalletStateSummary,
  WalletStateRankingSortBy,
  WalletStateDistribution,
} from "@/features/core/analytics/services/server/walletStateAnalytics";
import type { RankingResponse } from "@/features/core/analytics/types/common";

const BASE_PATH = "/api/admin/analytics/wallet/state";

/** 共通のユーザーフィルタ・パラメータ */
export type WalletStateClientUserFilter = {
  roles?: string;
  excludeDemo?: boolean;
};

// ============================================================================
// summary
// ============================================================================

export async function fetchWalletStateSummary(
  walletType: WalletType,
  params?: WalletStateClientUserFilter,
): Promise<WalletStateSummary> {
  try {
    const { data } = await axios.get<WalletStateSummary>(`${BASE_PATH}/summary`, {
      params: { walletType, ...params },
    });
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "ウォレットサマリーの取得に失敗しました");
  }
}

// ============================================================================
// ranking
// ============================================================================

export type WalletStateRankingClientParams = WalletStateClientUserFilter & {
  limit?: number;
  page?: number;
  sortBy?: WalletStateRankingSortBy;
};

type WalletStateRankingResponse = RankingResponse<{
  userId: string;
  displayName: string | null;
  balance: number;
  lockedBalance: number;
  updatedAt: string | null;
}> & { walletType: WalletType };

export async function fetchWalletStateRanking(
  walletType: WalletType,
  params?: WalletStateRankingClientParams,
): Promise<WalletStateRankingResponse> {
  try {
    const { data } = await axios.get<WalletStateRankingResponse>(
      `${BASE_PATH}/ranking`,
      { params: { walletType, ...params } },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "ウォレットランキングの取得に失敗しました");
  }
}

// ============================================================================
// distribution
// ============================================================================

export type WalletStateDistributionClientParams = WalletStateClientUserFilter & {
  /** 昇順の正整数配列。クライアントから API には CSV で渡す */
  boundaries: number[];
};

export async function fetchWalletStateDistribution(
  walletType: WalletType,
  params: WalletStateDistributionClientParams,
): Promise<WalletStateDistribution> {
  const { boundaries, ...rest } = params;
  try {
    const { data } = await axios.get<WalletStateDistribution>(
      `${BASE_PATH}/distribution`,
      {
        params: {
          walletType,
          boundaries: boundaries.join(","),
          ...rest,
        },
      },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "ウォレット分布の取得に失敗しました");
  }
}
