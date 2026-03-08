// src/features/notification/hooks/useUpdateNotification.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { NotificationUpdateFields } from "../entities/form";

export const useUpdateNotification = () =>
  useUpdateDomain<Notification, NotificationUpdateFields>(
    "notifications/update",
    notificationClient.update,
    "notifications",
  );
