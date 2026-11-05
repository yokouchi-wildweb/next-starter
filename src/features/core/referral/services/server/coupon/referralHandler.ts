// リファラル用クーポンハンドラー
//
// 招待コード使用時の副作用（referral 作成 + 報酬トリガー）を担当する。
// coupon ドメインのハンドラーレジストリに "referral" カテゴリとして登録される(registerReferralCouponHandler)。

import { registerCouponHandler } from "@/features/core/coupon/handlers";
import type { CouponRedeemedContext } from "@/features/core/coupon/handlers";
import { createReferralFromRedemption } from "../wrappers/createReferralFromRedemption";
import { referralRewardService } from "@/features/core/referralReward/services/server/referralRewardService";

/** 招待コードのカテゴリをクーポンに登録する。登録は coupon/handlers/init.ts が紹介の機能が開いているときだけ呼ぶ */
export function registerReferralCouponHandler(): void {
  registerCouponHandler("referral", {
    label: "招待リファラル",

    async onRedeemed({ coupon, userId }: CouponRedeemedContext): Promise<void> {
      const referral = await createReferralFromRedemption(coupon, userId);
      if (referral) {
        await referralRewardService.triggerRewards("signup_completed", referral);
      }
    },
  });
}
