// src/features/couponHistory/hooks/useCouponHistoryList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { couponHistoryClient } from "../services/client/couponHistoryClient";
import type { CouponHistory } from "../entities";
import type { SWRConfiguration } from "swr";

export const useCouponHistoryList = (config?: SWRConfiguration) =>
  useDomainList<CouponHistory>("couponHistories", couponHistoryClient.getAll, config);
