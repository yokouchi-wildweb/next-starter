// src/features/referralReward/services/server/referralRewardService.ts

import { base } from "./drizzleBase";
import { fulfillReward } from "./wrappers/fulfillReward";
import { triggerRewards } from "./wrappers/triggerRewards";
import { isFulfilled } from "./wrappers/isFulfilled";
import { getByReferral } from "./wrappers/getByReferral";

export const referralRewardService = {
  ...base,
  // 報酬配布
  fulfillReward,
  triggerRewards,
  // クエリ
  isFulfilled,
  getByReferral,
};
