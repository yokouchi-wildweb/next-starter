// src/features/coupon/services/client/couponClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { Coupon } from "@/features/core/coupon/entities";
import type {
  CouponCreateFields,
  CouponUpdateFields,
} from "@/features/core/coupon/entities/form";

export const couponClient: ApiClient<
  Coupon,
  CouponCreateFields,
  CouponUpdateFields
> = createApiClient<
  Coupon,
  CouponCreateFields,
  CouponUpdateFields
>("/api/coupon");
