// src/features/sample/hooks/useBulkDeleteByIdsSample.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { sampleClient } from "../services/client/sampleClient";

export const useBulkDeleteByIdsSample = () => {
  const bulkDeleteByIds = sampleClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("Sampleの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("samples/bulk-delete-by-ids", bulkDeleteByIds, "samples");
};
