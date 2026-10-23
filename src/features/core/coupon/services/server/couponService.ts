// src/features/coupon/services/server/couponService.ts

import { base } from "./drizzleBase";
import { duplicate } from "./wrappers/duplicate";
import { redeem } from "./redemption/redeem";
import { isUsable } from "./redemption/isUsable";
import { getUsageCount } from "./redemption/getUsageCount";
import {
  getCouponByCode,
  getCouponById,
  validateCouponStatically,
} from "./redemption/utils";
import { issueCodeForOwner } from "./ownership/issueCodeForOwner";
import { getCodesByOwner } from "./ownership/getCodesByOwner";
import { getInviteCode, getOrCreateInviteCode } from "./ownership/inviteCode";
import { validateForCategory } from "./wrappers/validateForCategory";
import { redeemWithEffect } from "./wrappers/redeemWithEffect";

export const couponService = {
  ...base,
  // 削除系のファイル処理は base の storage binding（drizzleBase）が行う。
  // duplicate はコードの再発行・使用回数のリセットのため独自（画像のコピーは binding の duplicateValues）。
  duplicate,
  // 使用処理
  redeem,
  isUsable,
  getUsageCount,
  // ハンドラー統合（カテゴリ付き検証・使用）
  validateForCategory,
  redeemWithEffect,
  // トランザクション対応ユーティリティ
  getCouponByCode,
  getCouponById,
  validateCouponStatically,
  // オーナーシップ（コード発行・取得）
  issueCodeForOwner,
  getCodesByOwner,
  getInviteCode,
  getOrCreateInviteCode,
};
