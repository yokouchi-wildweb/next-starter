// src/features/core/interactionTracking/services/client/interactionAdminClient.ts
// オーディエンスビューア（admin 専用）の HTTP クライアント

"use client";

import axios from "axios";

import type {
  InteractionAudienceEntry,
  InteractionAudienceOrderBy,
  InteractionAudienceSummaryMap,
} from "@/features/core/interactionTracking/entities/model";
import type { PaginatedResult } from "@/lib/crud/types";
import { normalizeHttpError } from "@/lib/errors";

const BASE_PATH = "/api/admin/interactions";

export type FetchAudienceParams = {
  targetType: string;
  targetId: string;
  action: string;
  page?: number;
  limit?: number;
  orderBy?: InteractionAudienceOrderBy;
};

/** オーディエンス一覧（ユーザー単位・ページネーション）を取得する */
export async function fetchInteractionAudience(
  params: FetchAudienceParams,
): Promise<PaginatedResult<InteractionAudienceEntry>> {
  try {
    const { data } = await axios.get<PaginatedResult<InteractionAudienceEntry>>(
      `${BASE_PATH}/audience`,
      { params },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "オーディエンスの取得に失敗しました");
  }
}

/** action 別サマリー（累計 / ログイン済み / 匿名）を取得する */
export async function fetchInteractionAudienceSummary(
  targetType: string,
  targetId: string,
): Promise<InteractionAudienceSummaryMap> {
  try {
    const { data } = await axios.get<InteractionAudienceSummaryMap>(
      `${BASE_PATH}/audience-summary`,
      { params: { targetType, targetId } },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "サマリーの取得に失敗しました");
  }
}
