// src/features/userTag/hooks/useBulkDeleteByQueryUserTag.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";

export const useBulkDeleteByQueryUserTag = () => {
  const bulkDeleteByQuery = userTagClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("UserTagの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("userTags/bulk-delete-by-query", bulkDeleteByQuery, "userTags");
};
