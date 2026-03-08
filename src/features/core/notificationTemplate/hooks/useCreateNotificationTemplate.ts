// src/features/notificationTemplate/hooks/useCreateNotificationTemplate.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { NotificationTemplateCreateFields } from "../entities/form";

export const useCreateNotificationTemplate = () =>
  useCreateDomain<NotificationTemplate, NotificationTemplateCreateFields>("notificationTemplates/create", notificationTemplateClient.create, "notificationTemplates");
