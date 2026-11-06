// 生成物・編集不可: pnpm generate extensions が src/features/core/user/extensionPoints.ts から生成する
// adminBulkActions: src/features/core/user/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkAction(並びはファイル名の順)

import type { UserAdminBulkActionItem } from "@/features/core/user/types";

import { bulkAction as adminBulkActions_userTags } from "@/features/core/user/adminBulkActions/userTags";

const adminBulkActionsList: UserAdminBulkActionItem[] = [
  adminBulkActions_userTags,
];
export const adminBulkActions: Readonly<Record<string, UserAdminBulkActionItem>> = Object.assign(Object.create(null), Object.fromEntries(adminBulkActionsList.map((item) => [String(item.key), item])));
if (Object.keys(adminBulkActions).length !== adminBulkActionsList.length) throw new Error("adminBulkActions: key が重複している項目がある");
