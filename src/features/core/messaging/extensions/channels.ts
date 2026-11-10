// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// channels: src/features/core/messaging/channels/<名前>.ts(x) か <名前>/index.ts(x) の export const channel(並びはファイル名の順)

import type { MessageChannel } from "@/lib/messaging";

const channelsList: MessageChannel[] = [];
export const channels: Readonly<Record<string, MessageChannel>> = Object.assign(Object.create(null), Object.fromEntries(channelsList.map((item) => [String(item.key), item])));
if (Object.keys(channels).length !== channelsList.length) throw new Error("channels: key が重複している項目がある");
