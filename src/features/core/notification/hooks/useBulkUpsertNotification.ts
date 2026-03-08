// src/features/notification/hooks/useBulkUpsertNotification.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { NotificationCreateFields } from "../entities/form";

export const useBulkUpsertNotification = () => {
  const bulkUpsert = notificationClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("Notificationの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<Notification, NotificationCreateFields>(
    "notifications/bulk-upsert",
    bulkUpsert,
    "notifications",
  );
};
