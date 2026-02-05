// src/features/core/user/hooks/useBulkDeleteByQueryUser.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";

export const useBulkDeleteByQueryUser = () => {
  const bulkDeleteByQuery = userClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("Userの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("users/bulk-delete-by-query", bulkDeleteByQuery, "users");
};
