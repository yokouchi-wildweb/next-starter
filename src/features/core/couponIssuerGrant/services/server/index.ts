// src/features/core/couponIssuerGrant/services/server/index.ts

export { couponIssuerGrantBase } from "./drizzleBase";
export { getGrantByUser } from "./queries";
export {
  applyGrant,
  reviewGrant,
  suspendGrant,
  reinstateGrant,
  updateGrantSettings,
  type ApplyGrantParams,
  type ReviewGrantParams,
  type SuspendGrantParams,
  type ReinstateGrantParams,
  type UpdateGrantSettingsParams,
} from "./grants";
export {
  issueForGrant,
  getCurrentPeriodCoupon,
  syncCurrentPeriodCoupon,
  setCurrentPeriodCouponStatus,
  type IssueForGrantResult,
} from "./issuance";
export {
  getCouponIssuerProgram,
  isCouponIssuerProgramEnabled,
  requireCouponIssuerProgram,
} from "./program";

import { couponIssuerGrantBase } from "./drizzleBase";
import { getGrantByUser } from "./queries";
import {
  applyGrant,
  reinstateGrant,
  reviewGrant,
  suspendGrant,
  updateGrantSettings,
} from "./grants";
import { getCurrentPeriodCoupon, issueForGrant, syncCurrentPeriodCoupon } from "./issuance";

/**
 * 発行者プログラムサービス。
 * serviceRegistry には admin の一覧・検索用として登録する。状態遷移は専用関数を使う
 * （汎用 update での遷移は当期クーポン同期・監査の意味づけを飛ばすため想定しない）。
 */
export const couponIssuerGrantService = {
  ...couponIssuerGrantBase,
  getByUser: getGrantByUser,
  apply: applyGrant,
  review: reviewGrant,
  suspend: suspendGrant,
  reinstate: reinstateGrant,
  updateSettings: updateGrantSettings,
  issueForGrant,
  getCurrentPeriodCoupon,
  syncCurrentPeriodCoupon,
};
