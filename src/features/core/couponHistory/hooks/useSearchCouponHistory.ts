// src/features/couponHistory/hooks/useSearchCouponHistory.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { couponHistoryClient } from "../services/client/couponHistoryClient";
import type { CouponHistory } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type CouponHistorySearchParams = typeof couponHistoryClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchCouponHistory = (params: CouponHistorySearchParams) => {
  const search = couponHistoryClient.search;

  if (!search) {
    throw new Error("CouponHistoryの検索機能が利用できません");
  }

  return useSearchDomain<CouponHistory, CouponHistorySearchParams>(
    "couponHistories/search",
    search,
    params,
  );
};
