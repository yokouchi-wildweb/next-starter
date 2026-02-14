// src/features/referralReward/hooks/useBulkUpdateReferralReward.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { ReferralRewardUpdateFields } from "../entities/form";

export const useBulkUpdateReferralReward = () => {
  const bulkUpdate = referralRewardClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("ReferralRewardの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<ReferralReward, ReferralRewardUpdateFields>(
    "referralRewards/bulk-update",
    bulkUpdate,
    "referralRewards",
  );
};
