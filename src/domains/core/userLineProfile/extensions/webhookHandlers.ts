// 生成物・編集不可: pnpm generate extensions が src/domains/core/userLineProfile/extensionPoints.ts から生成する
// webhookHandlers: src/domains/core/userLineProfile/webhookHandlers/<名前>.ts(x) か <名前>/index.ts(x) の export const handler(並びはファイル名の順)

import type { LineWebhookEventHandler } from "@/domains/core/userLineProfile/types/webhook";

export const webhookHandlers: LineWebhookEventHandler[] = [];
