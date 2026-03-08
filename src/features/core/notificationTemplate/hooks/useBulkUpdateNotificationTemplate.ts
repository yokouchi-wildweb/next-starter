// src/features/notificationTemplate/hooks/useBulkUpdateNotificationTemplate.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { NotificationTemplateUpdateFields } from "../entities/form";

export const useBulkUpdateNotificationTemplate = () => {
  const bulkUpdate = notificationTemplateClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("NotificationTemplateの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<NotificationTemplate, NotificationTemplateUpdateFields>(
    "notificationTemplates/bulk-update",
    bulkUpdate,
    "notificationTemplates",
  );
};
