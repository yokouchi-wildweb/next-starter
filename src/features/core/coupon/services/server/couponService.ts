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
  // remove / bulkDeleteByIds / hardDelete 等の削除系は base が storageCleanupFields を
  // 受け取り Storage クリーンアップまで行うため、個別ラッパーは不要。
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
