// 生成物・編集不可: pnpm generate extensions が src/features/core/messaging/extensionPoints.ts から生成する
// subscribers: src/features/core/messaging/subscribers/<名前>.ts(x) か <名前>/index.ts(x) の export const subscriber(並びはファイル名の順)

import type { MessageSubscriber } from "@/lib/messaging";

const subscribersList: MessageSubscriber[] = [];
export const subscribers: Readonly<Record<string, MessageSubscriber>> = Object.assign(Object.create(null), Object.fromEntries(subscribersList.map((item) => [String(item.key), item])));
if (Object.keys(subscribers).length !== subscribersList.length) throw new Error("subscribers: key が重複している項目がある");
