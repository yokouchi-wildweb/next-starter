// src/features/core/notification/types/adminBulkAction.ts

import type { BulkActionItem } from "@/lib/tableSuite";
import type { Notification } from "@/features/core/notification/entities";
import type { AdminBulkActionAccess } from "@/features/core/user/types";

/**
 * お知らせの管理一覧の一括操作の項目(src/features/core/notification/adminBulkActions/<名前>.tsx の export const bulkAction)。
 * 一覧は 1 つなので lists は使わない。作り方: src/lib/tableSuite/README.md「一括操作の受け口」
 */
export type NotificationAdminBulkActionItem = BulkActionItem<Notification, AdminBulkActionAccess>;
