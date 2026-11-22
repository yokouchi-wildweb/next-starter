// src/domains/couponHistory/services/client/couponHistoryClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { CouponHistory } from "@/domains/core/couponHistory/entities";
import type {
  CouponHistoryCreateFields,
  CouponHistoryUpdateFields,
} from "@/domains/core/couponHistory/entities/form";

export const couponHistoryClient: ApiClient<
  CouponHistory,
  CouponHistoryCreateFields,
  CouponHistoryUpdateFields
> = createApiClient<
  CouponHistory,
  CouponHistoryCreateFields,
  CouponHistoryUpdateFields
>("/api/couponHistory");
