// src/features/userTag/hooks/useBulkUpsertUserTag.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { UserTagCreateFields } from "../entities/form";

export const useBulkUpsertUserTag = () => {
  const bulkUpsert = userTagClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("UserTagの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<UserTag, UserTagCreateFields>(
    "userTags/bulk-upsert",
    bulkUpsert,
    "userTags",
  );
};
