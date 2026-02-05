// src/features/core/user/hooks/useBulkDeleteByIdsUser.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";

export const useBulkDeleteByIdsUser = () => {
  const bulkDeleteByIds = userClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("Userの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("users/bulk-delete-by-ids", bulkDeleteByIds, "users");
};
