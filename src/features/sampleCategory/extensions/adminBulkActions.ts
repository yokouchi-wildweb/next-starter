// 生成物・編集不可: pnpm extensions:generate が src/features/sampleCategory/extensionPoints.ts から生成する
// adminBulkActions: src/features/sampleCategory/adminBulkActions/<名前>.ts(x) か <名前>/index.ts(x) の export const bulkAction(並びはファイル名の順)

import type { SampleCategoryAdminBulkActionItem } from "@/features/sampleCategory/types/adminBulkAction";

const adminBulkActionsList: SampleCategoryAdminBulkActionItem[] = [];
export const adminBulkActions: Readonly<Record<string, SampleCategoryAdminBulkActionItem>> = Object.assign(Object.create(null), Object.fromEntries(adminBulkActionsList.map((item) => [String(item.key), item])));
if (Object.keys(adminBulkActions).length !== adminBulkActionsList.length) throw new Error("adminBulkActions: key が重複している項目がある");
