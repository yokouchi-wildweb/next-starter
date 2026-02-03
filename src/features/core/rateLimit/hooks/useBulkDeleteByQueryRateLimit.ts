// src/features/rateLimit/hooks/useBulkDeleteByQueryRateLimit.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { rateLimitClient } from "../services/client/rateLimitClient";

export const useBulkDeleteByQueryRateLimit = () => {
  const bulkDeleteByQuery = rateLimitClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("RateLimitの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("rateLimits/bulk-delete-by-query", bulkDeleteByQuery, "rateLimits");
};
