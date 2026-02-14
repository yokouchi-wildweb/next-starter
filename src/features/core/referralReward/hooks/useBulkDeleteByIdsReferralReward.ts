// src/features/referralReward/hooks/useBulkDeleteByIdsReferralReward.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";

export const useBulkDeleteByIdsReferralReward = () => {
  const bulkDeleteByIds = referralRewardClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("ReferralRewardの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("referralRewards/bulk-delete-by-ids", bulkDeleteByIds, "referralRewards");
};
