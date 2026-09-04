// src/features/core/couponIssuerGrant/constants/index.ts

/**
 * 発行権のステータス。
 * - pending:   申請中（管理者の審査待ち）
 * - approved:  承認済み（発行可能）
 * - rejected:  却下（再申請可）
 * - suspended: 停止（承認後に管理者が停止。発行不可。reinstate で復帰）
 */
export const COUPON_ISSUER_GRANT_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type CouponIssuerGrantStatus = (typeof COUPON_ISSUER_GRANT_STATUSES)[number];

export const CouponIssuerGrantStatusOptions = [
  { value: "pending", label: "申請中" },
  { value: "approved", label: "承認済" },
  { value: "rejected", label: "却下" },
  { value: "suspended", label: "停止中" },
] as const;

/** 管理者アクション（PATCH /api/admin/coupon-issuer-grants/[id]） */
export const COUPON_ISSUER_GRANT_ADMIN_ACTIONS = [
  "approve",
  "reject",
  "suspend",
  "reinstate",
  "update_settings",
] as const;
export type CouponIssuerGrantAdminAction = (typeof COUPON_ISSUER_GRANT_ADMIN_ACTIONS)[number];
