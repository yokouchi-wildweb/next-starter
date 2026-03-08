// src/features/notificationTemplate/services/client/notificationTemplateClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import type {
  NotificationTemplateCreateFields,
  NotificationTemplateUpdateFields,
} from "@/features/core/notificationTemplate/entities/form";

export const notificationTemplateClient: ApiClient<
  NotificationTemplate,
  NotificationTemplateCreateFields,
  NotificationTemplateUpdateFields
> = createApiClient<
  NotificationTemplate,
  NotificationTemplateCreateFields,
  NotificationTemplateUpdateFields
>("/api/notificationTemplate");
