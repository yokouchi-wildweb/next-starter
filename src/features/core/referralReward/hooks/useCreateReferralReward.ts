// src/features/referralReward/hooks/useCreateReferralReward.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { ReferralRewardCreateFields } from "../entities/form";

export const useCreateReferralReward = () =>
  useCreateDomain<ReferralReward, ReferralRewardCreateFields>("referralRewards/create", referralRewardClient.create, "referralRewards");
