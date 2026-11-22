// src/domains/referralReward/hooks/useDeleteReferralReward.ts

"use client";

import { useDeleteDomain } from "@/lib/crud";
import { referralRewardClient } from "../services/client/referralRewardClient";

export const useDeleteReferralReward = () => useDeleteDomain("referralRewards/delete", referralRewardClient.delete, "referralRewards");
