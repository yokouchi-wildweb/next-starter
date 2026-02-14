// src/features/referralReward/hooks/useBulkUpsertReferralReward.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { ReferralRewardCreateFields } from "../entities/form";

export const useBulkUpsertReferralReward = () => {
  const bulkUpsert = referralRewardClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("ReferralRewardの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<ReferralReward, ReferralRewardCreateFields>(
    "referralRewards/bulk-upsert",
    bulkUpsert,
    "referralRewards",
  );
};
