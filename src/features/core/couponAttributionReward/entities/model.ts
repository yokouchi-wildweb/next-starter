// src/features/core/couponAttributionReward/entities/model.ts

import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { CouponAttributionRewardStatus } from "@/features/core/couponAttributionReward/constants";

export type CouponAttributionReward = {
  id: string;
  coupon_id: string;
  coupon_history_id: string;
  recipient_user_id: string;
  redeemer_user_id: string | null;
  wallet_type: WalletTypeValue;
  amount: number;
  status: CouponAttributionRewardStatus;
  wallet_history_id: string | null;
  fulfilled_at: Date | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 受取人本人へ返す公開形（GET /api/me/coupon-attribution-rewards）。
 *
 * 発行者（受取人）が「誰が消込したか」を知れないことをデータ層で保証する:
 * redeemer_user_id / coupon_history_id / wallet_history_id（消込者・購入へ辿れる ID）、
 * failure_reason（運用者向け例外文言）、updatedAt は含めない。
 * recipient_user_id は本人自身なので省く。
 * metadata は許可リスト（src/registry/couponAttributionRewardRecipientMetadataRegistry.ts）の
 * キーのみ通す（上流既定は空 = 常に {}）。
 */
export type CouponAttributionRewardForRecipient = Pick<
  CouponAttributionReward,
  "id" | "coupon_id" | "wallet_type" | "amount" | "status" | "fulfilled_at" | "createdAt"
> & {
  metadata: Record<string, unknown>;
};

export function toCouponAttributionRewardForRecipient(
  row: CouponAttributionReward,
  options: { metadataKeys?: readonly string[] } = {},
): CouponAttributionRewardForRecipient {
  const allowed = options.metadataKeys ?? [];
  const metadata: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in row.metadata) {
      metadata[key] = row.metadata[key];
    }
  }
  return {
    id: row.id,
    coupon_id: row.coupon_id,
    wallet_type: row.wallet_type,
    amount: row.amount,
    status: row.status,
    fulfilled_at: row.fulfilled_at,
    createdAt: row.createdAt,
    metadata,
  };
}

/** 受取人本人向けの集計（GET /api/me/coupon-attribution-rewards/summary） */
export type CouponAttributionRewardSummary = {
  /** fulfilled の合計額 */
  fulfilledAmount: number;
  /** fulfilled の件数 */
  fulfilledCount: number;
  /** pending の合計額（付与途中・再試行待ち） */
  pendingAmount: number;
};
