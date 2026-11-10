// src/featureGate/rules/referral.ts
// マーケティング > 紹介(招待の画面は mypageInvite.ts。招待クーポンを使うのでクーポン coupon に dependsOn。referral の requires と同じ)

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  dependsOn: ["coupon"],
  pathPatterns: [
    // /api/referral(と自前の /api/referral/**)・/api/referralReward は domains から導く
    "/api/admin/referral",
    // 招待クーポン(type invite)の管理画面は紹介の画面(coupon の /admin/coupons の下。入れ子 = dependsOn coupon)
    "/admin/coupons/invite",
  ],
  domains: [
    "core/referral",
    "core/referralReward",
  ],
  defaultEnabled: false,
};
