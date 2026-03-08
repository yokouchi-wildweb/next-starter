// src/features/notification/hooks/useCreateNotification.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";
import type { Notification } from "../entities";
import type { NotificationCreateFields } from "../entities/form";

export const useCreateNotification = () =>
  useCreateDomain<Notification, NotificationCreateFields>("notifications/create", notificationClient.create, "notifications");
