// src/domains/userTag/hooks/useBulkDeleteByIdsUserTag.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud";
import { userTagClient } from "../services/client/userTagClient";

export const useBulkDeleteByIdsUserTag = () => {
  const bulkDeleteByIds = userTagClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("UserTagの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("userTags/bulk-delete-by-ids", bulkDeleteByIds, "userTags");
};
