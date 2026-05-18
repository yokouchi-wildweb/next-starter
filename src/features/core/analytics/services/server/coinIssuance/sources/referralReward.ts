// src/features/core/analytics/services/server/coinIssuance/sources/referralReward.ts
// coinIssuance ソース: 紹介リワードによるコイン発行。
//
// 集計対象:
//   referral_rewards のうち status='fulfilled' のレコードに対して、
//   metadata.amount (default) または rewardAmountExpr で抽出した金額を合計する。
//
// 実装方針:
//   referralAnalytics.aggregateReferralRewardCurrentVsPrev() を呼ぶだけの薄いラッパー。
//   既存 getReferralSummary の rewardTotal 計算と完全に同じ SQL が走るので、
//   この 2 つの値は常に一致する (rewardAmountExpr を差し替えない限り)。
//
// UserFilter:
//   既存 referralAnalytics と同じく rewardTotal には UserFilter を適用しない。
//   recipient_user_id 経由でフィルタしたい下流は独自 source で代替する。
//
// rewardAmountExpr のカスタマイズ:
//   下流の metadata 構造が異なる場合、このソース定義をコピーして独自 key で
//   登録するか、aggregateReferralRewardCurrentVsPrev を直接呼ぶカスタム source
//   を実装する。

import { aggregateReferralRewardCurrentVsPrev } from "../../referralAnalytics";
import type { CoinIssuanceSource } from "../types";

export const referralRewardSource: CoinIssuanceSource = {
  key: "referral_reward",
  kind: "issuance",

  async aggregate({ range, prevRange }) {
    return aggregateReferralRewardCurrentVsPrev({ range, prevRange });
  },
};
