// src/features/referralReward/hooks/useBulkDeleteByQueryReferralReward.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";

export const useBulkDeleteByQueryReferralReward = () => {
  const bulkDeleteByQuery = referralRewardClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("ReferralRewardの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("referralRewards/bulk-delete-by-query", bulkDeleteByQuery, "referralRewards");
};
