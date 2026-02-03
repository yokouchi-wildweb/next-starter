// src/features/rateLimit/hooks/useSearchRateLimit.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type RateLimitSearchParams = typeof rateLimitClient.search extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchRateLimit = (params: RateLimitSearchParams) => {
  const search = rateLimitClient.search;

  if (!search) {
    throw new Error("RateLimitの検索機能が利用できません");
  }

  return useSearchDomain<RateLimit, RateLimitSearchParams>(
    "rateLimits/search",
    search,
    params,
  );
};
