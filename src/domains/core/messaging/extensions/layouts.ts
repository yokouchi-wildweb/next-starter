// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// layouts: src/domains/core/messaging/layouts/*/layout.ts の export const layout(folder = フォルダ名、並びはフォルダ名の順。隣の layout.override.ts の disabled・adminSelectable を重ねる)

import type { MessageLayoutItem } from "@/lib/messaging";

import { layout as layouts_alert } from "@/domains/core/messaging/layouts/alert/layout";
import { layout as layouts_link } from "@/domains/core/messaging/layouts/link/layout";
import { layout as layouts_notice } from "@/domains/core/messaging/layouts/notice/layout";
import { layout as layouts_simple } from "@/domains/core/messaging/layouts/simple/layout";
import { layout as layouts_statement } from "@/domains/core/messaging/layouts/statement/layout";
import { layout as layouts_welcome } from "@/domains/core/messaging/layouts/welcome/layout";

const layoutsList: MessageLayoutItem[] = [
  { ...layouts_alert, folder: "alert" },
  { ...layouts_link, folder: "link" },
  { ...layouts_notice, folder: "notice" },
  { ...layouts_simple, folder: "simple" },
  { ...layouts_statement, folder: "statement" },
  { ...layouts_welcome, folder: "welcome" },
];
export const layouts: Readonly<Record<string, MessageLayoutItem>> = Object.assign(Object.create(null), Object.fromEntries(layoutsList.map((item) => [String(item.key), item])));
if (Object.keys(layouts).length !== layoutsList.length) throw new Error("layouts: key が重複している項目がある");
