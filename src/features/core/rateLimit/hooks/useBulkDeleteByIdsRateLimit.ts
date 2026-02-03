// src/features/rateLimit/hooks/useBulkDeleteByIdsRateLimit.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";

export const useBulkDeleteByIdsRateLimit = () => {
  const bulkDeleteByIds = rateLimitClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("RateLimitの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("rateLimits/bulk-delete-by-ids", bulkDeleteByIds, "rateLimits");
};
