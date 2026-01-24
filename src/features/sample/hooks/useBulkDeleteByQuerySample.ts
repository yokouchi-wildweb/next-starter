// src/features/sample/hooks/useBulkDeleteByQuerySample.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";

export const useBulkDeleteByQuerySample = () => {
  const bulkDeleteByQuery = sampleClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("Sampleの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("samples/bulk-delete-by-query", bulkDeleteByQuery, "samples");
};
