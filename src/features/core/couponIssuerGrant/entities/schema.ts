// src/features/core/couponIssuerGrant/entities/schema.ts

import { z } from "zod";

import {
  COUPON_ISSUER_GRANT_ADMIN_ACTIONS,
  COUPON_ISSUER_GRANT_STATUSES,
} from "@/features/core/couponIssuerGrant/constants";

const SettingsSchema = z.record(z.string(), z.unknown());

/**
 * CRUD ベース (drizzleBase) の create バリデーション。
 * 主経路は apply()（本人申請）であり、汎用 create は管理者による代理登録用。
 */
export const CouponIssuerGrantCreateSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(COUPON_ISSUER_GRANT_STATUSES).optional(),
  settings: SettingsSchema.optional(),
  application: SettingsSchema.optional(),
  admin_note: z.string().max(4000).nullable().optional(),
});

export type CouponIssuerGrantCreateInput = z.infer<typeof CouponIssuerGrantCreateSchema>;

/** CRUD ベースの update バリデーション（wrapper からの状態遷移で使用） */
export const CouponIssuerGrantUpdateSchema = z.object({
  status: z.enum(COUPON_ISSUER_GRANT_STATUSES).optional(),
  settings: SettingsSchema.optional(),
  application: SettingsSchema.optional(),
  requested_at: z.date().optional(),
  reviewed_at: z.date().nullable().optional(),
  reviewed_by: z.string().uuid().nullable().optional(),
  admin_note: z.string().max(4000).nullable().optional(),
  updatedAt: z.date().optional(),
});

export type CouponIssuerGrantUpdateInput = z.infer<typeof CouponIssuerGrantUpdateSchema>;

export type CouponIssuerGrantWriteInput = CouponIssuerGrantCreateInput &
  Partial<CouponIssuerGrantUpdateInput>;

/** 本人申請 API (POST /api/me/coupon-issuer/apply) の入力 */
export const ApplyCouponIssuerGrantSchema = z.object({
  /** 申請フォームの内容（下流定義の自由形式、最大 16KB 相当） */
  application: SettingsSchema.optional(),
});

export type ApplyCouponIssuerGrantInput = z.infer<typeof ApplyCouponIssuerGrantSchema>;

/** 管理者アクション API (PATCH /api/admin/coupon-issuer-grants/[id]) の入力 */
export const CouponIssuerGrantAdminActionSchema = z.object({
  action: z.enum(COUPON_ISSUER_GRANT_ADMIN_ACTIONS),
  /** approve / update_settings で使用。approve 時省略なら既存値を維持 */
  settings: SettingsSchema.optional(),
  adminNote: z.string().max(4000).nullable().optional(),
});

export type CouponIssuerGrantAdminActionInput = z.infer<typeof CouponIssuerGrantAdminActionSchema>;
