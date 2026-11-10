// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// categories: src/features/core/messaging/categories/<名前>.ts(x) か <名前>/index.ts(x) の export const category(並びはファイル名の順)

import type { MessageCategory } from "@/lib/messaging";

const categoriesList: MessageCategory[] = [];
export const categories: Readonly<Record<string, MessageCategory>> = Object.assign(Object.create(null), Object.fromEntries(categoriesList.map((item) => [String(item.key), item])));
if (Object.keys(categories).length !== categoriesList.length) throw new Error("categories: key が重複している項目がある");
