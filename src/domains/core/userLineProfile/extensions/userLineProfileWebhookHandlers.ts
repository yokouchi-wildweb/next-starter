// 生成物・編集不可: pnpm generate extensions が src/domains/core/userLineProfile/extensionPoints.ts から生成する
// userLineProfileWebhookHandlers: 差す側の <ドメイン>/plugs/userLineProfileWebhookHandlers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const handler(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { LineWebhookEventHandler } from "@/domains/core/userLineProfile/types/webhook";

export const userLineProfileWebhookHandlers: { domain: string | null; name: string; requires: readonly string[]; plug: LineWebhookEventHandler }[] = [];
