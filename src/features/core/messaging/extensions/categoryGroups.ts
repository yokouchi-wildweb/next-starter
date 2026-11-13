// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// categoryGroups: src/features/core/messaging/categoryGroups/<名前>.ts(x) か <名前>/index.ts(x) の export const group(並びはファイル名の順)

import type { MessageCategoryGroup } from "@/lib/messaging";

const categoryGroupsList: MessageCategoryGroup[] = [];
export const categoryGroups: Readonly<Record<string, MessageCategoryGroup>> = Object.assign(Object.create(null), Object.fromEntries(categoryGroupsList.map((item) => [String(item.key), item])));
if (Object.keys(categoryGroups).length !== categoryGroupsList.length) throw new Error("categoryGroups: key が重複している項目がある");
