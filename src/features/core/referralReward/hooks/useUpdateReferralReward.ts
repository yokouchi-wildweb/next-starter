// src/features/referralReward/hooks/useUpdateReferralReward.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { ReferralRewardUpdateFields } from "../entities/form";

export const useUpdateReferralReward = () =>
  useUpdateDomain<ReferralReward, ReferralRewardUpdateFields>(
    "referralRewards/update",
    referralRewardClient.update,
    "referralRewards",
  );
