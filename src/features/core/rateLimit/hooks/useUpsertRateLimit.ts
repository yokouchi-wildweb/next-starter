// src/features/rateLimit/hooks/useUpsertRateLimit.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { RateLimitCreateFields } from "../entities/form";

export const useUpsertRateLimit = () => {
  const upsert = rateLimitClient.upsert;

  if (!upsert) {
    throw new Error("RateLimitのアップサート機能が利用できません");
  }

  return useUpsertDomain<RateLimit, RateLimitCreateFields>(
    "rateLimits/upsert",
    upsert,
    "rateLimits",
  );
};
