// 招待コードの消込スコープ（単一定義）
//
// 「何が招待コードか」は referral ドメインの責務。登録処理の消込とログイン前検証の
// 両方がこの定義を使うことで、受理条件のズレを構造的に防ぐ。
// 招待コードは couponService.getOrCreateInviteCode が type=invite / category=referral で発行する。

import type { RedeemScope } from "@/features/core/coupon/types/redeem";

export const INVITE_CODE_REDEEM_SCOPE: RedeemScope = {
  types: ["invite"],
};
