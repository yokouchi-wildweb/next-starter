// src/features/core/couponAttributionReward/entities/schema.ts

import { z } from "zod";

import { COUPON_ATTRIBUTION_REWARD_STATUSES } from "@/features/core/couponAttributionReward/constants";

/**
 * CRUD ベース (drizzleBase) の create バリデーション。
 * 主経路は grant()（付与 + 台帳記録を同一 tx で実施）であり、汎用 create の直接利用は
 * 想定しない（管理 API から作っても付与は走らない）。
 */
export const CouponAttributionRewardCreateSchema = z.object({
  coupon_id: z.string().uuid(),
  coupon_history_id: z.string().uuid(),
  recipient_user_id: z.string().uuid(),
  redeemer_user_id: z.string().uuid().nullable().optional(),
  wallet_type: z.string().min(1),
  amount: z.number().int().nonnegative(),
  status: z.enum(COUPON_ATTRIBUTION_REWARD_STATUSES).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CouponAttributionRewardCreateInput = z.infer<typeof CouponAttributionRewardCreateSchema>;

/** CRUD ベースの update バリデーション（管理者の手動補正・運用メモ用途） */
export const CouponAttributionRewardUpdateSchema = z.object({
  status: z.enum(COUPON_ATTRIBUTION_REWARD_STATUSES).optional(),
  wallet_history_id: z.string().uuid().nullable().optional(),
  fulfilled_at: z.date().nullable().optional(),
  failure_reason: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  updatedAt: z.date().optional(),
});

export type CouponAttributionRewardUpdateInput = z.infer<typeof CouponAttributionRewardUpdateSchema>;

export type CouponAttributionRewardWriteInput = CouponAttributionRewardCreateInput &
  Partial<CouponAttributionRewardUpdateInput>;
