// src/features/milestone/hooks/useBulkDeleteByIdsMilestone.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { milestoneClient } from "../services/client/milestoneClient";

export const useBulkDeleteByIdsMilestone = () => {
  const bulkDeleteByIds = milestoneClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("Milestoneの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("milestones/bulk-delete-by-ids", bulkDeleteByIds, "milestones");
};
