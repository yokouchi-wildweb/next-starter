// src/features/core/user/hooks/useBulkUpdateByIdsUser.ts
"use client";

import { useBulkUpdateByIdsDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { UserBulkUpdateInput } from "../services/types";

/** 複数ユーザーに同じ値を入れる。更新できる列は USER_BULK_UPDATE.fields のみ */
export const useBulkUpdateByIdsUser = () => {
  const bulkUpdateByIds = userClient.bulkUpdateByIds;

  if (!bulkUpdateByIds) {
    throw new Error("ユーザーの一括更新機能が利用できません");
  }

  return useBulkUpdateByIdsDomain<UserBulkUpdateInput>("users/bulk-update-by-ids", bulkUpdateByIds, "users");
};
