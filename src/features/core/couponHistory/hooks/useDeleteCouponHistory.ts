// src/features/couponHistory/hooks/useDeleteCouponHistory.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { couponHistoryClient } from "../services/client/couponHistoryClient";

export const useDeleteCouponHistory = () => useDeleteDomain("couponHistories/delete", couponHistoryClient.delete, "couponHistories");
