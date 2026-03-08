// src/features/notification/hooks/useSearchNotification.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type NotificationSearchParams = NonNullable<typeof notificationClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchNotification = (params: NotificationSearchParams) => {
  const search = notificationClient.search;

  if (!search) {
    throw new Error("Notificationの検索機能が利用できません");
  }

  return useSearchDomain<Notification, NotificationSearchParams>(
    "notifications/search",
    search,
    params,
  );
};
