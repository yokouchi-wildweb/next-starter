// src/domains/referralReward/services/server/referralRewardService.ts

import { referralRewardBase } from "./referralRewardBase";
import { fulfillReward } from "./wrappers/fulfillReward";
import { triggerRewards } from "./wrappers/triggerRewards";
import { isFulfilled } from "./wrappers/isFulfilled";
import { getByReferral } from "./wrappers/getByReferral";

export const referralRewardService = {
  ...referralRewardBase,
  // 報酬配布
  fulfillReward,
  triggerRewards,
  // クエリ
  isFulfilled,
  getByReferral,
};
