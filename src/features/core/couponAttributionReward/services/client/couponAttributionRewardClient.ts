"use client";

// src/features/core/couponAttributionReward/services/client/couponAttributionRewardClient.ts

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";
import type { PaginatedResult } from "@/lib/crud";
import type {
  CouponAttributionReward,
  CouponAttributionRewardSummary,
} from "@/features/core/couponAttributionReward/entities/model";

const BASE = "/api/me/coupon-attribution-rewards";

/** 自分が受け取った帰属報酬の一覧（ページング必須） */
export async function fetchMyAttributionRewards(params: {
  page: number;
  limit: number;
}): Promise<PaginatedResult<CouponAttributionReward>> {
  try {
    const res = await axios.get<PaginatedResult<CouponAttributionReward>>(BASE, { params });
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "報酬履歴の取得に失敗しました");
  }
}

/** 自分の帰属報酬の集計（累計額など） */
export async function fetchMyAttributionRewardSummary(): Promise<CouponAttributionRewardSummary> {
  try {
    const res = await axios.get<{ summary: CouponAttributionRewardSummary }>(`${BASE}/summary`);
    return res.data.summary;
  } catch (error) {
    throw normalizeHttpError(error, "報酬集計の取得に失敗しました");
  }
}
