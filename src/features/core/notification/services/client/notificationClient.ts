// src/features/notification/services/client/notificationClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { Notification } from "@/features/notification/entities";
import type {
  NotificationCreateFields,
  NotificationUpdateFields,
} from "@/features/notification/entities/form";

export const notificationClient: ApiClient<
  Notification,
  NotificationCreateFields,
  NotificationUpdateFields
> = createApiClient<
  Notification,
  NotificationCreateFields,
  NotificationUpdateFields
>("/api/notification");
