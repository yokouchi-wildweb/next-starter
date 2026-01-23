// src/features/couponHistory/hooks/useUpdateCouponHistory.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { couponHistoryClient } from "../services/client/couponHistoryClient";
import type { CouponHistory } from "../entities";
import type { CouponHistoryUpdateFields } from "../entities/form";

export const useUpdateCouponHistory = () =>
  useUpdateDomain<CouponHistory, CouponHistoryUpdateFields>(
    "couponHistories/update",
    couponHistoryClient.update,
    "couponHistories",
  );
