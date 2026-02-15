// src/features/referralReward/hooks/useSearchReferralReward.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { referralRewardClient } from "../services/client/referralRewardClient";
import type { ReferralReward } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type ReferralRewardSearchParams = NonNullable<typeof referralRewardClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchReferralReward = (params: ReferralRewardSearchParams) => {
  const search = referralRewardClient.search;

  if (!search) {
    throw new Error("ReferralRewardの検索機能が利用できません");
  }

  return useSearchDomain<ReferralReward, ReferralRewardSearchParams>(
    "referralRewards/search",
    search,
    params,
  );
};
