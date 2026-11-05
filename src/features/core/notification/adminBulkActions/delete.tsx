// src/features/core/notification/adminBulkActions/delete.tsx
// お知らせの一覧: 選んだお知らせを一括で削除する。上流の既定の項目(D149)

import { bulkDeleteAction } from "@/lib/crud/components";
import { domainDisplay as notificationDisplay } from "@/features/core/notification/entities/display";
import type { NotificationAdminBulkActionItem } from "@/features/core/notification/types/adminBulkAction";

export const bulkAction: NotificationAdminBulkActionItem = bulkDeleteAction(
  { key: "delete", order: 100 },
  { domain: notificationDisplay, title: "お知らせを{count}件削除" },
);
