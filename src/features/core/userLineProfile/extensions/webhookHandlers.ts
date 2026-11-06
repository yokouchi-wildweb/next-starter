// 生成物・編集不可: pnpm generate extensions が src/features/core/userLineProfile/extensionPoints.ts から生成する
// webhookHandlers: src/features/core/userLineProfile/webhookHandlers/<名前>.ts(x) か <名前>/index.ts(x) の export const handler(並びはファイル名の順)

import type { LineWebhookEventHandler } from "@/features/core/userLineProfile/types/webhook";

export const webhookHandlers: LineWebhookEventHandler[] = [];
