// src/features/sampleTag/hooks/useBulkDeleteByQuerySampleTag.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { sampleTagClient } from "../services/client/sampleTagClient";

export const useBulkDeleteByQuerySampleTag = () => {
  const bulkDeleteByQuery = sampleTagClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("SampleTagの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("sampleTags/bulk-delete-by-query", bulkDeleteByQuery, "sampleTags");
};
