// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// layouts: src/features/core/messaging/layouts/*/layout.ts の export const layout(folder = フォルダ名、並びはフォルダ名の順)

import type { MessageLayoutItem } from "@/lib/messaging";

const layoutsList: MessageLayoutItem[] = [];
export const layouts: Readonly<Record<string, MessageLayoutItem>> = Object.assign(Object.create(null), Object.fromEntries(layoutsList.map((item) => [String(item.key), item])));
if (Object.keys(layouts).length !== layoutsList.length) throw new Error("layouts: key が重複している項目がある");
