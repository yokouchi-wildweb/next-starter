// src/features/core/couponIssuerGrant/index.ts
//
// 発行者プログラムドメインの公開エントリーポイント (client-safe)。
//
// 申請・審査・発行などの server-only API はこのバレルから export しない。
// server コードからの利用は専用パスを使う:
//   import { couponIssuerGrantService } from "@/features/core/couponIssuerGrant/services/server";

export type {
  CouponIssuerGrant,
  CouponIssuerGrantForUser,
} from "./entities/model";
export type {
  CouponIssuerProgramConfig,
  PeriodPolicy,
  IssuancePeriod,
  ProgramIssueParams,
  ProgramCouponPatch,
} from "./types/program";
export {
  COUPON_ISSUER_GRANT_STATUSES,
  COUPON_ISSUER_GRANT_ADMIN_ACTIONS,
  CouponIssuerGrantStatusOptions,
  type CouponIssuerGrantStatus,
  type CouponIssuerGrantAdminAction,
} from "./constants";
export { resolveIssuancePeriod, DEFAULT_PERIOD_TIME_ZONE } from "./utils/period";
