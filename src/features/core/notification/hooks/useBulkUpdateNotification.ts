// src/features/notification/hooks/useBulkUpdateNotification.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { NotificationUpdateFields } from "../entities/form";

export const useBulkUpdateNotification = () => {
  const bulkUpdate = notificationClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("Notificationの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<Notification, NotificationUpdateFields>(
    "notifications/bulk-update",
    bulkUpdate,
    "notifications",
  );
};
