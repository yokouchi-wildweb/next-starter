// src/features/couponHistory/hooks/useUpsertCouponHistory.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { couponHistoryClient } from "../services/client/couponHistoryClient";
import type { CouponHistory } from "../entities";
import type { CouponHistoryCreateFields } from "../entities/form";

export const useUpsertCouponHistory = () => {
  const upsert = couponHistoryClient.upsert;

  if (!upsert) {
    throw new Error("CouponHistoryのアップサート機能が利用できません");
  }

  return useUpsertDomain<CouponHistory, CouponHistoryCreateFields>(
    "couponHistories/upsert",
    upsert,
    "couponHistories",
  );
};
