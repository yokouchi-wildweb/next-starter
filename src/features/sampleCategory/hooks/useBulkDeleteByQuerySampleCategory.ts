// src/features/sampleCategory/hooks/useBulkDeleteByQuerySampleCategory.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { sampleCategoryClient } from "../services/client/sampleCategoryClient";

export const useBulkDeleteByQuerySampleCategory = () => {
  const bulkDeleteByQuery = sampleCategoryClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("SampleCategoryの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("sampleCategories/bulk-delete-by-query", bulkDeleteByQuery, "sampleCategories");
};
