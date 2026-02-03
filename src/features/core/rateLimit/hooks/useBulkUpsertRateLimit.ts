// src/features/rateLimit/hooks/useBulkUpsertRateLimit.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";
import type { RateLimit } from "../entities";
import type { RateLimitCreateFields } from "../entities/form";

export const useBulkUpsertRateLimit = () => {
  const bulkUpsert = rateLimitClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("RateLimitの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<RateLimit, RateLimitCreateFields>(
    "rateLimits/bulk-upsert",
    bulkUpsert,
    "rateLimits",
  );
};
