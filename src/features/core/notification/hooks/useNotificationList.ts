// src/features/notification/hooks/useNotificationList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { SWRConfiguration } from "swr";

export const useNotificationList = (config?: SWRConfiguration) =>
  useDomainList<Notification>("notifications", notificationClient.getAll, config);
