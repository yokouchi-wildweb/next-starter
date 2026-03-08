// src/features/notificationTemplate/hooks/useBulkUpsertNotificationTemplate.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { NotificationTemplateCreateFields } from "../entities/form";

export const useBulkUpsertNotificationTemplate = () => {
  const bulkUpsert = notificationTemplateClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("NotificationTemplateの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<NotificationTemplate, NotificationTemplateCreateFields>(
    "notificationTemplates/bulk-upsert",
    bulkUpsert,
    "notificationTemplates",
  );
};
