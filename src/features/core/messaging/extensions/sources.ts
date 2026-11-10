// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// sources: src/features/core/messaging/sources/<名前>.ts(x) か <名前>/index.ts(x) の export const source(並びはファイル名の順)

import type { MessageSource } from "@/lib/messaging";

const sourcesList: MessageSource[] = [];
export const sources: Readonly<Record<string, MessageSource>> = Object.assign(Object.create(null), Object.fromEntries(sourcesList.map((item) => [String(item.key), item])));
if (Object.keys(sources).length !== sourcesList.length) throw new Error("sources: key が重複している項目がある");
