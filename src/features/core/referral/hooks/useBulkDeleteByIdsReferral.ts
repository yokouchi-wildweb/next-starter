// src/features/referral/hooks/useBulkDeleteByIdsReferral.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";

export const useBulkDeleteByIdsReferral = () => {
  const bulkDeleteByIds = referralClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("Referralの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("referrals/bulk-delete-by-ids", bulkDeleteByIds, "referrals");
};
