// src/domains/couponHistory/hooks/useCouponHistory.ts

"use client";

import { useDomain } from "@/lib/crud";
import { couponHistoryClient } from "../services/client/couponHistoryClient";
import type { CouponHistory } from "../entities";

export const useCouponHistory = (id?: string | null) =>
  useDomain<CouponHistory | undefined>(
    id ? `couponHistory:${id}` : null,
    () => couponHistoryClient.get(id!) as Promise<CouponHistory>,
  );
