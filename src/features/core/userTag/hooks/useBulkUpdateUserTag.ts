// src/features/userTag/hooks/useBulkUpdateUserTag.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { UserTagUpdateFields } from "../entities/form";

export const useBulkUpdateUserTag = () => {
  const bulkUpdate = userTagClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("UserTagの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<UserTag, UserTagUpdateFields>(
    "userTags/bulk-update",
    bulkUpdate,
    "userTags",
  );
};
