// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// layouts: src/features/core/messaging/layouts/*/layout.ts の export const layout(folder = フォルダ名、並びはフォルダ名の順)

import type { MessageLayoutItem } from "@/lib/messaging";

import { layout as layouts_alert } from "@/features/core/messaging/layouts/alert/layout";
import { layout as layouts_link } from "@/features/core/messaging/layouts/link/layout";
import { layout as layouts_notice } from "@/features/core/messaging/layouts/notice/layout";
import { layout as layouts_statement } from "@/features/core/messaging/layouts/statement/layout";
import { layout as layouts_welcome } from "@/features/core/messaging/layouts/welcome/layout";

const layoutsList: MessageLayoutItem[] = [
  { ...layouts_alert, folder: "alert" },
  { ...layouts_link, folder: "link" },
  { ...layouts_notice, folder: "notice" },
  { ...layouts_statement, folder: "statement" },
  { ...layouts_welcome, folder: "welcome" },
];
export const layouts: Readonly<Record<string, MessageLayoutItem>> = Object.assign(Object.create(null), Object.fromEntries(layoutsList.map((item) => [String(item.key), item])));
if (Object.keys(layouts).length !== layoutsList.length) throw new Error("layouts: key が重複している項目がある");
