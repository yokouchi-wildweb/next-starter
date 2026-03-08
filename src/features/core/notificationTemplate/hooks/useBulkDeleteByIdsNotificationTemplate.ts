// src/features/notificationTemplate/hooks/useBulkDeleteByIdsNotificationTemplate.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";

export const useBulkDeleteByIdsNotificationTemplate = () => {
  const bulkDeleteByIds = notificationTemplateClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("NotificationTemplateの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("notificationTemplates/bulk-delete-by-ids", bulkDeleteByIds, "notificationTemplates");
};
