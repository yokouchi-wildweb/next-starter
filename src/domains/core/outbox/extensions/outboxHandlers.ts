// 生成物・編集不可: pnpm generate extensions が src/domains/core/outbox/extensionPoints.ts から生成する
// outboxHandlers: 差す側の <ドメイン>/plugs/outboxHandlers/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const handler(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す。隣の <名前>.override.ts の maxAttempts・backoff を重ねる)

import type { OutboxHandler } from "@/domains/core/outbox/points";

export const outboxHandlers: { domain: string | null; name: string; requires: readonly string[]; plug: OutboxHandler }[] = [];
