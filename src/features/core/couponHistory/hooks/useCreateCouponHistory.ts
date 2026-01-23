// src/features/couponHistory/hooks/useCreateCouponHistory.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { couponHistoryClient } from "../services/client/couponHistoryClient";
import type { CouponHistory } from "../entities";
import type { CouponHistoryCreateFields } from "../entities/form";

export const useCreateCouponHistory = () =>
  useCreateDomain<CouponHistory, CouponHistoryCreateFields>("couponHistories/create", couponHistoryClient.create, "couponHistories");
