// src/features/core/couponIssuerGrant/entities/model.ts

import type { CouponIssuerGrantStatus } from "@/features/core/couponIssuerGrant/constants";

export type CouponIssuerGrant = {
  id: string;
  user_id: string;
  status: CouponIssuerGrantStatus;
  settings: Record<string, unknown>;
  application: Record<string, unknown>;
  requested_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  admin_note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 本人へ返す公開形（GET /api/me/coupon-issuer）。
 * 管理側の情報（reviewed_by / admin_note）は含めない。
 */
export type CouponIssuerGrantForUser = Omit<CouponIssuerGrant, "reviewed_by" | "admin_note">;

export function toCouponIssuerGrantForUser(grant: CouponIssuerGrant): CouponIssuerGrantForUser {
  const { reviewed_by: _reviewedBy, admin_note: _adminNote, ...rest } = grant;
  return rest;
}
