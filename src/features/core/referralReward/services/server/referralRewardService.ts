// src/features/referralReward/services/server/referralRewardService.ts

import { base } from "./drizzleBase";
import { fulfillReward } from "./wrappers/fulfillReward";
import { triggerRewards } from "./wrappers/triggerRewards";
import { isFulfilled } from "./wrappers/isFulfilled";
import { getByReferral } from "./wrappers/getByReferral";

// ハンドラー自動登録（下流プロジェクトで handlers/index.ts にインポートを追加すると自動的に登録される）
import "./handlers";

export const referralRewardService = {
  ...base,
  // 報酬配布
  fulfillReward,
  triggerRewards,
  // クエリ
  isFulfilled,
  getByReferral,
};
