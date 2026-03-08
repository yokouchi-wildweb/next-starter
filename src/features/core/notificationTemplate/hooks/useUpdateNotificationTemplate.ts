// src/features/notificationTemplate/hooks/useUpdateNotificationTemplate.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { NotificationTemplateUpdateFields } from "../entities/form";

export const useUpdateNotificationTemplate = () =>
  useUpdateDomain<NotificationTemplate, NotificationTemplateUpdateFields>(
    "notificationTemplates/update",
    notificationTemplateClient.update,
    "notificationTemplates",
  );
