// src/features/core/user/hooks/useBulkAddUserTags.ts
"use client";

import { useBulkAddRelationDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";

/** 複数ユーザーにタグを足す(既存のタグは残る)。trigger(userIds, tagIds) */
export const useBulkAddUserTags = () => {
  const bulkAddRelation = userClient.bulkAddRelation;

  if (!bulkAddRelation) {
    throw new Error("ユーザータグの一括追加機能が利用できません");
  }

  return useBulkAddRelationDomain("users/bulk-add-tags", bulkAddRelation, "user_tag_ids", "users");
};
