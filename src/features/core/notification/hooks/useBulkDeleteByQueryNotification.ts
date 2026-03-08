// src/features/notification/hooks/useBulkDeleteByQueryNotification.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";

export const useBulkDeleteByQueryNotification = () => {
  const bulkDeleteByQuery = notificationClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("Notificationの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("notifications/bulk-delete-by-query", bulkDeleteByQuery, "notifications");
};
