// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// adminBulkActions: src/features/core/messaging/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkAction(並びはファイル名の順)

import type { MessagingDispatchAdminBulkActionItem } from "@/features/core/messaging/types/adminBulkAction";

import { bulkAction as adminBulkActions_delete } from "@/features/core/messaging/adminBulkActions/delete";

const adminBulkActionsList: MessagingDispatchAdminBulkActionItem[] = [
  adminBulkActions_delete,
];
export const adminBulkActions: Readonly<Record<string, MessagingDispatchAdminBulkActionItem>> = Object.assign(Object.create(null), Object.fromEntries(adminBulkActionsList.map((item) => [String(item.key), item])));
if (Object.keys(adminBulkActions).length !== adminBulkActionsList.length) throw new Error("adminBulkActions: key が重複している項目がある");
