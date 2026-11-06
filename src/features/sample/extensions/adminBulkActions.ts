// 生成物・編集不可: pnpm generate extensions が src/features/sample/extensionPoints.ts から生成する
// adminBulkActions: src/features/sample/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkAction(並びはファイル名の順)

import type { SampleAdminBulkActionItem } from "@/features/sample/types/adminBulkAction";

const adminBulkActionsList: SampleAdminBulkActionItem[] = [];
export const adminBulkActions: Readonly<Record<string, SampleAdminBulkActionItem>> = Object.assign(Object.create(null), Object.fromEntries(adminBulkActionsList.map((item) => [String(item.key), item])));
if (Object.keys(adminBulkActions).length !== adminBulkActionsList.length) throw new Error("adminBulkActions: key が重複している項目がある");
