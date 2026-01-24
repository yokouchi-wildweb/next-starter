// src/features/__domain__/hooks/useBulkDeleteByQuery__Domain__.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { __domain__Client } from "../services/client/__domain__Client";

export const useBulkDeleteByQuery__Domain__ = () => {
  const bulkDeleteByQuery = __domain__Client.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("__Domain__の条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("__domains__/bulk-delete-by-query", bulkDeleteByQuery, "__domains__");
};
