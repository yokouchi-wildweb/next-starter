// src/features/referral/hooks/useSearchReferral.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type ReferralSearchParams = NonNullable<typeof referralClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchReferral = (params: ReferralSearchParams) => {
  const search = referralClient.search;

  if (!search) {
    throw new Error("Referralの検索機能が利用できません");
  }

  return useSearchDomain<Referral, ReferralSearchParams>(
    "referrals/search",
    search,
    params,
  );
};
