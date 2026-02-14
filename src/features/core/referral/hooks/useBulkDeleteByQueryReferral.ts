// src/features/referral/hooks/useBulkDeleteByQueryReferral.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";

export const useBulkDeleteByQueryReferral = () => {
  const bulkDeleteByQuery = referralClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("Referralの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("referrals/bulk-delete-by-query", bulkDeleteByQuery, "referrals");
};
