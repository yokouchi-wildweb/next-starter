// src/features/__domain__/hooks/useBulkDeleteByIds__Domain__.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";

export const useBulkDeleteByIds__Domain__ = () => {
  const bulkDeleteByIds = __domain__Client.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("__Domain__の一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("__domains__/bulk-delete-by-ids", bulkDeleteByIds, "__domains__");
};
