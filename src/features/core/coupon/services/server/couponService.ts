// src/features/coupon/services/server/couponService.ts

import { base } from "./drizzleBase";
import { remove } from "./wrappers/remove";
import { duplicate } from "./wrappers/duplicate";

export const couponService = {
  ...base,
  remove,
  duplicate,
};
