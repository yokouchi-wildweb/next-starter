// src/features/core/couponAttributionReward/services/server/index.ts

export { couponAttributionRewardBase } from "./drizzleBase";
export {
  grantAttributionReward,
  retryAttributionReward,
  type GrantAttributionRewardParams,
  type GrantAttributionRewardResult,
} from "./grant";
export { getRewardByCouponHistory, getRecipientRewardSummary } from "./queries";

import { couponAttributionRewardBase } from "./drizzleBase";
import { grantAttributionReward, retryAttributionReward } from "./grant";
import { getRewardByCouponHistory, getRecipientRewardSummary } from "./queries";

/**
 * 帰属報酬サービス。
 * 付与は grant（ハンドラー onRedeemed から tx 付きで呼ぶ）、回復は retry。
 * serviceRegistry には admin の一覧・検索用として登録する（汎用 create/update での付与は行われない）。
 */
export const couponAttributionRewardService = {
  ...couponAttributionRewardBase,
  grant: grantAttributionReward,
  retry: retryAttributionReward,
  getByCouponHistory: getRewardByCouponHistory,
  getRecipientSummary: getRecipientRewardSummary,
};
