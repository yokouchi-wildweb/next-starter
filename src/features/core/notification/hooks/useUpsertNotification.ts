// src/features/notification/hooks/useUpsertNotification.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { NotificationCreateFields } from "../entities/form";

export const useUpsertNotification = () => {
  const upsert = notificationClient.upsert;

  if (!upsert) {
    throw new Error("Notificationのアップサート機能が利用できません");
  }

  return useUpsertDomain<Notification, NotificationCreateFields>(
    "notifications/upsert",
    upsert,
    "notifications",
  );
};
