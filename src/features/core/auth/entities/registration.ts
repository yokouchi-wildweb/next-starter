// src/features/core/auth/entities/registration.ts
//
// 本登録レスポンスの共有型（サーバー / クライアント双方から参照）

import type { UsabilityReason } from "@/features/core/coupon/types/redeem";

/**
 * 招待コードの適用結果。
 * - null: 招待コード未指定（または referral 無効）
 * - applied=true: 消込成功（referral 作成・報酬トリガーはハンドラー側）
 * - applied=false: 消込不成立。reason は UsabilityReason（"error" = 例外で判定不能）
 */
export type RegistrationInviteCodeResult = {
  applied: boolean;
  reason?: UsabilityReason | "error";
};
