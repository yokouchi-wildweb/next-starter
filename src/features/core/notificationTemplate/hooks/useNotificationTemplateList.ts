// src/features/notificationTemplate/hooks/useNotificationTemplateList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { SWRConfiguration } from "swr";

export const useNotificationTemplateList = (config?: SWRConfiguration) =>
  useDomainList<NotificationTemplate>("notificationTemplates", notificationTemplateClient.getAll, config);
