// src/features/core/user/hooks/useBulkRemoveUserTags.ts
"use client";

import { useBulkRemoveRelationDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";

/** 複数ユーザーから指定のタグだけを外す(他のタグは残る)。trigger(userIds, tagIds) */
export const useBulkRemoveUserTags = () => {
  const bulkRemoveRelation = userClient.bulkRemoveRelation;

  if (!bulkRemoveRelation) {
    throw new Error("ユーザータグの一括削除機能が利用できません");
  }

  return useBulkRemoveRelationDomain("users/bulk-remove-tags", bulkRemoveRelation, "user_tag_ids", "users");
};
