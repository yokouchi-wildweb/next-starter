// src/features/referralReward/hooks/useUpsertReferralReward.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { ReferralRewardCreateFields } from "../entities/form";

export const useUpsertReferralReward = () => {
  const upsert = referralRewardClient.upsert;

  if (!upsert) {
    throw new Error("ReferralRewardのアップサート機能が利用できません");
  }

  return useUpsertDomain<ReferralReward, ReferralRewardCreateFields>(
    "referralRewards/upsert",
    upsert,
    "referralRewards",
  );
};
