// src/features/couponHistory/services/client/couponHistoryClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { CouponHistory } from "@/features/core/couponHistory/entities";
import type {
  CouponHistoryCreateFields,
  CouponHistoryUpdateFields,
} from "@/features/core/couponHistory/entities/form";

export const couponHistoryClient: ApiClient<
  CouponHistory,
  CouponHistoryCreateFields,
  CouponHistoryUpdateFields
> = createApiClient<
  CouponHistory,
  CouponHistoryCreateFields,
  CouponHistoryUpdateFields
>("/api/couponHistory");
