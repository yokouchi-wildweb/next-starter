// src/features/notification/hooks/useBulkDeleteByIdsNotification.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";

export const useBulkDeleteByIdsNotification = () => {
  const bulkDeleteByIds = notificationClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("Notificationの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("notifications/bulk-delete-by-ids", bulkDeleteByIds, "notifications");
};
