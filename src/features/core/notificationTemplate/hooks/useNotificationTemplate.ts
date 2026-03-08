// src/features/notificationTemplate/hooks/useNotificationTemplate.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";

export const useNotificationTemplate = (id?: string | null) =>
  useDomain<NotificationTemplate | undefined>(
    id ? `notificationTemplate:${id}` : null,
    () => notificationTemplateClient.getById(id!) as Promise<NotificationTemplate>,
  );
