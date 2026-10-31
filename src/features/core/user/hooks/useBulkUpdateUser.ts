// src/features/core/user/hooks/useBulkUpdateUser.ts
"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { UserBulkUpdateInput } from "../services/types";

/** レコードごとに違う値で一括更新する。更新できる列は USER_BULK_UPDATE.fields のみ */
export const useBulkUpdateUser = () => {
  const bulkUpdate = userClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("ユーザーの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<User, UserBulkUpdateInput>("users/bulk-update", bulkUpdate, "users");
};
