// src/features/coupon/hooks/useCouponList.ts

"use client";

import { useDomainList } from "@/lib/crud";
import { couponClient } from "../services/client/couponClient";
import type { Coupon } from "../entities";
import type { SWRConfiguration } from "swr";

export const useCouponList = (config?: SWRConfiguration) =>
  useDomainList<Coupon>("coupons", couponClient.getAll, config);
