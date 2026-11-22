// 生成物・編集不可: pnpm generate extensions が src/domains/core/messaging/extensionPoints.ts から生成する
// messagingCategoryGroups: 差す側の <ドメイン>/plugs/messagingCategoryGroups/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const group(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { MessageCategoryGroup } from "@/lib/messaging";

export const messagingCategoryGroups: { domain: string | null; name: string; requires: readonly string[]; plug: MessageCategoryGroup }[] = [];
