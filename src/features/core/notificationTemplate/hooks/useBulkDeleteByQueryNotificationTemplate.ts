// src/features/notificationTemplate/hooks/useBulkDeleteByQueryNotificationTemplate.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";

export const useBulkDeleteByQueryNotificationTemplate = () => {
  const bulkDeleteByQuery = notificationTemplateClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("NotificationTemplateの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("notificationTemplates/bulk-delete-by-query", bulkDeleteByQuery, "notificationTemplates");
};
