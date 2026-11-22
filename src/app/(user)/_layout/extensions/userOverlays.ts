// 生成物・編集不可: pnpm generate extensions が src/app/(user)/_layout/extensionPoints.ts から生成する
// userOverlays: 差す側の <ドメイン>/plugs/userOverlays/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const part(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { FramePart } from "@/app/(user)/_layout/points";

import { part as userOverlays_messaging_inboxUnread } from "@/domains/core/messaging/plugs/userOverlays/inboxUnread";

export const userOverlays: { domain: string | null; name: string; requires: readonly string[]; plug: FramePart }[] = [
  { domain: "messaging", name: "inboxUnread", requires: [], plug: userOverlays_messaging_inboxUnread },
];
