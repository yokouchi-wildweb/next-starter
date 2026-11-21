// src/features/referralReward/hooks/useReferralReward.ts

"use client";

import { useDomain } from "@/lib/crud";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";

export const useReferralReward = (id?: string | null) =>
  useDomain<ReferralReward | undefined>(
    id ? `referralReward:${id}` : null,
    () => referralRewardClient.get(id!) as Promise<ReferralReward>,
  );
