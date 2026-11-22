// src/domains/referralReward/hooks/useReferralRewardList.ts

"use client";

import { useDomainList } from "@/lib/crud";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { SWRConfiguration } from "swr";

export const useReferralRewardList = (config?: SWRConfiguration) =>
  useDomainList<ReferralReward>("referralRewards", referralRewardClient.getAll, config);
