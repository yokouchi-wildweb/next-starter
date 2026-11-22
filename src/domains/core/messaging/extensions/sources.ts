// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// sources: src/domains/core/messaging/sources/<名前>.ts(x) か <名前>/index.ts(x) の export const source(並びはファイル名の順)

import type { MessageSource } from "@/lib/messaging";

import { source as sources_adminBulk } from "@/domains/core/messaging/sources/adminBulk";
import { source as sources_adminBulkTest } from "@/domains/core/messaging/sources/adminBulkTest";
import { source as sources_adminSend } from "@/domains/core/messaging/sources/adminSend";
import { source as sources_adminSendTest } from "@/domains/core/messaging/sources/adminSendTest";
import { source as sources_legacyNotification } from "@/domains/core/messaging/sources/legacyNotification";

const sourcesList: MessageSource[] = [
  sources_adminBulk,
  sources_adminBulkTest,
  sources_adminSend,
  sources_adminSendTest,
  sources_legacyNotification,
];
export const sources: Readonly<Record<string, MessageSource>> = Object.assign(Object.create(null), Object.fromEntries(sourcesList.map((item) => [String(item.key), item])));
if (Object.keys(sources).length !== sourcesList.length) throw new Error("sources: key が重複している項目がある");
