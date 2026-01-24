// src/features/sampleTag/hooks/useBulkDeleteByIdsSampleTag.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";

export const useBulkDeleteByIdsSampleTag = () => {
  const bulkDeleteByIds = sampleTagClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("SampleTagの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("sampleTags/bulk-delete-by-ids", bulkDeleteByIds, "sampleTags");
};
