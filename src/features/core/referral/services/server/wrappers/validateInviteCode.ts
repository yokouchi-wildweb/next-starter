// 招待コードのログイン前検証
//
// サインアップフォームで入力されたコードが「招待コードとして使えるか」をプレビューする。
// 使用者が未確定（未ログイン）のため、使用者依存の判定（自己消込・ユーザー毎上限）は省略する。
// 本登録時の消込（registration.ts）は使用者付きで全判定を再実行するため、ここは UX 用の先行判定に過ぎない。

import { couponService } from "@/features/core/coupon/services/server/couponService";
import type { UsabilityReason } from "@/features/core/coupon/types/redeem";
import { INVITE_CODE_REDEEM_SCOPE } from "../../../constants/inviteCodeScope";

export type InviteCodeValidationResult =
  | { valid: true }
  | { valid: false; reason: UsabilityReason };

/**
 * 招待コードが使用可能か（ログイン前プレビュー）
 *
 * reason は内部診断用。公開 API では存在の列挙を防ぐため reason を返さず valid のみ露出する。
 */
export async function validateInviteCode(code: string): Promise<InviteCodeValidationResult> {
  const result = await couponService.isUsable(code, null, {
    scope: INVITE_CODE_REDEEM_SCOPE,
    skipRedeemerChecks: true,
  });

  if (!result.usable) {
    return { valid: false, reason: result.reason };
  }

  return { valid: true };
}
