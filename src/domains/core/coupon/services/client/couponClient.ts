// src/domains/coupon/services/client/couponClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { Coupon } from "@/domains/core/coupon/entities";
import type {
  CouponCreateFields,
  CouponUpdateFields,
} from "@/domains/core/coupon/entities/form";

export const couponClient: ApiClient<
  Coupon,
  CouponCreateFields,
  CouponUpdateFields
> = createApiClient<
  Coupon,
  CouponCreateFields,
  CouponUpdateFields
>("/api/coupon");
