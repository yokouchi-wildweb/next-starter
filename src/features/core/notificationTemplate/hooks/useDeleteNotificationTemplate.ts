// src/features/notificationTemplate/hooks/useDeleteNotificationTemplate.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";

export const useDeleteNotificationTemplate = () => useDeleteDomain("notificationTemplates/delete", notificationTemplateClient.delete, "notificationTemplates");
