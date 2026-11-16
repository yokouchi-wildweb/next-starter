// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// layoutEmails: src/features/core/messaging/layouts/*/email.tsx の export const emailRenderer(folder = フォルダ名、並びはフォルダ名の順)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { emailRenderer as layoutEmails_notice } from "@/features/core/messaging/layouts/notice/email";

const layoutEmailsList: MessageLayoutEmailRenderer[] = [
  { ...layoutEmails_notice, folder: "notice" },
];
export const layoutEmails: Readonly<Record<string, MessageLayoutEmailRenderer>> = Object.assign(Object.create(null), Object.fromEntries(layoutEmailsList.map((item) => [String(item.layout), item])));
if (Object.keys(layoutEmails).length !== layoutEmailsList.length) throw new Error("layoutEmails: layout が重複している項目がある");
