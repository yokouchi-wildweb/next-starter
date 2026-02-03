// src/features/rateLimit/hooks/useBulkUpdateRateLimit.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { RateLimitUpdateFields } from "../entities/form";

export const useBulkUpdateRateLimit = () => {
  const bulkUpdate = rateLimitClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("RateLimitの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<RateLimit, RateLimitUpdateFields>(
    "rateLimits/bulk-update",
    bulkUpdate,
    "rateLimits",
  );
};
