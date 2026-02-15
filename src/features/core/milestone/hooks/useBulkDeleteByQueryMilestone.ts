// src/features/milestone/hooks/useBulkDeleteByQueryMilestone.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";

export const useBulkDeleteByQueryMilestone = () => {
  const bulkDeleteByQuery = milestoneClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("Milestoneの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("milestones/bulk-delete-by-query", bulkDeleteByQuery, "milestones");
};
