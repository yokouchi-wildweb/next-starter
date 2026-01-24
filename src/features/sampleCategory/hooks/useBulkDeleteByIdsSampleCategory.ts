// src/features/sampleCategory/hooks/useBulkDeleteByIdsSampleCategory.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";

export const useBulkDeleteByIdsSampleCategory = () => {
  const bulkDeleteByIds = sampleCategoryClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("SampleCategoryの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("sampleCategories/bulk-delete-by-ids", bulkDeleteByIds, "sampleCategories");
};
