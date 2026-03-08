// src/features/notificationTemplate/hooks/useSearchNotificationTemplate.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { notificationTemplateClient } from "../services/client/notificationTemplateClient";
import type { NotificationTemplate } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type NotificationTemplateSearchParams = NonNullable<typeof notificationTemplateClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchNotificationTemplate = (params: NotificationTemplateSearchParams) => {
  const search = notificationTemplateClient.search;

  if (!search) {
    throw new Error("NotificationTemplateの検索機能が利用できません");
  }

  return useSearchDomain<NotificationTemplate, NotificationTemplateSearchParams>(
    "notificationTemplates/search",
    search,
    params,
  );
};
