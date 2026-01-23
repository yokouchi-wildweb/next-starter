// src/features/coupon/services/server/couponService.ts

import { base } from "./drizzleBase";
import { remove } from "./wrappers/remove";
import { duplicate } from "./wrappers/duplicate";
import { redeem } from "./redemption/redeem";
import { isUsable } from "./redemption/isUsable";
import { getUsageCount } from "./redemption/getUsageCount";

export const couponService = {
  ...base,
  remove,
  duplicate,
  // 使用処理
  redeem,
  isUsable,
  getUsageCount,
};
