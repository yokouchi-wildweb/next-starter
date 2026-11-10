// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// audiences: src/features/core/messaging/audiences/<名前>.ts(x) か <名前>/index.ts(x) の export const audience(並びはファイル名の順)

import type { MessageAudience } from "@/lib/messaging";

const audiencesList: MessageAudience[] = [];
export const audiences: Readonly<Record<string, MessageAudience>> = Object.assign(Object.create(null), Object.fromEntries(audiencesList.map((item) => [String(item.key), item])));
if (Object.keys(audiences).length !== audiencesList.length) throw new Error("audiences: key が重複している項目がある");
