// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// layoutEmails: src/domains/core/messaging/layouts/*/email.tsx の export const emailRenderer(folder = フォルダ名、並びはフォルダ名の順)

import type { MessageLayoutEmailRenderer } from "@/lib/messaging";

import { emailRenderer as layoutEmails_alert } from "@/domains/core/messaging/layouts/alert/email";
import { emailRenderer as layoutEmails_link } from "@/domains/core/messaging/layouts/link/email";
import { emailRenderer as layoutEmails_notice } from "@/domains/core/messaging/layouts/notice/email";
import { emailRenderer as layoutEmails_simple } from "@/domains/core/messaging/layouts/simple/email";
import { emailRenderer as layoutEmails_statement } from "@/domains/core/messaging/layouts/statement/email";
import { emailRenderer as layoutEmails_welcome } from "@/domains/core/messaging/layouts/welcome/email";

const layoutEmailsList: MessageLayoutEmailRenderer[] = [
  { ...layoutEmails_alert, folder: "alert" },
  { ...layoutEmails_link, folder: "link" },
  { ...layoutEmails_notice, folder: "notice" },
  { ...layoutEmails_simple, folder: "simple" },
  { ...layoutEmails_statement, folder: "statement" },
  { ...layoutEmails_welcome, folder: "welcome" },
];
export const layoutEmails: Readonly<Record<string, MessageLayoutEmailRenderer>> = Object.assign(Object.create(null), Object.fromEntries(layoutEmailsList.map((item) => [String(item.layout), item])));
if (Object.keys(layoutEmails).length !== layoutEmailsList.length) throw new Error("layoutEmails: layout が重複している項目がある");
