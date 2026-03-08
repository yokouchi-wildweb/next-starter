// src/features/notificationTemplate/hooks/useUpsertNotificationTemplate.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { NotificationTemplateCreateFields } from "../entities/form";

export const useUpsertNotificationTemplate = () => {
  const upsert = notificationTemplateClient.upsert;

  if (!upsert) {
    throw new Error("NotificationTemplateのアップサート機能が利用できません");
  }

  return useUpsertDomain<NotificationTemplate, NotificationTemplateCreateFields>(
    "notificationTemplates/upsert",
    upsert,
    "notificationTemplates",
  );
};
