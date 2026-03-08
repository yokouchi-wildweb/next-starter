// src/features/notification/hooks/useNotification.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";

export const useNotification = (id?: string | null) =>
  useDomain<Notification | undefined>(
    id ? `notification:${id}` : null,
    () => notificationClient.getById(id!) as Promise<Notification>,
  );
