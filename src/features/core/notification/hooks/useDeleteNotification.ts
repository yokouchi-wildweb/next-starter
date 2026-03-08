// src/features/notification/hooks/useDeleteNotification.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { notificationClient } from "../services/client/notificationClient";

export const useDeleteNotification = () => useDeleteDomain("notifications/delete", notificationClient.delete, "notifications");
