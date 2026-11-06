// 生成物・編集不可: pnpm generate extensions が src/features/core/notification/extensionPoints.ts から生成する
// adminBulkActions: src/features/core/notification/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkAction(並びはファイル名の順)

import type { NotificationAdminBulkActionItem } from "@/features/core/notification/types/adminBulkAction";

import { bulkAction as adminBulkActions_delete } from "@/features/core/notification/adminBulkActions/delete";

const adminBulkActionsList: NotificationAdminBulkActionItem[] = [
  adminBulkActions_delete,
];
export const adminBulkActions: Readonly<Record<string, NotificationAdminBulkActionItem>> = Object.assign(Object.create(null), Object.fromEntries(adminBulkActionsList.map((item) => [String(item.key), item])));
if (Object.keys(adminBulkActions).length !== adminBulkActionsList.length) throw new Error("adminBulkActions: key が重複している項目がある");
