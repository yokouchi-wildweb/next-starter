// src/domains/core/messaging/services/server/layoutLists.ts
//
// レイアウトの表(点 messagingLayouts・messagingLayoutEmails の一覧から、閉じたドメインの項目を外す)と鍵の表にする手。
// 送信チャンネルの項目(plugs/messagingChannels/email)が読むので、送信チャンネルの一覧を読む ./lists.ts と分ける(値の輪を作らない)。
// 読み手は ./lists.ts の再出しからも引ける

import "server-only";

import { gate } from "@/featureGate";
import type { MessageLayoutEmailRenderer, MessageLayoutItem } from "@/lib/messaging";

import { messagingLayoutEmails } from "../../extensions/messagingLayoutEmails";
import { messagingLayouts } from "../../extensions/messagingLayouts";

/** 項目を鍵の表に(null プロトタイプ。鍵の一意は生成器が止める) */
export function keyedPlugs<T>(entries: readonly { plug: T }[], keyOf: (item: T) => string): Readonly<Record<string, T>> {
  return Object.assign(Object.create(null), Object.fromEntries(entries.map((entry) => [keyOf(entry.plug), entry.plug])));
}

/** レイアウト(鍵 → 欄の定義) */
export const layouts: Readonly<Record<string, MessageLayoutItem>> = keyedPlugs(gate.plugs(messagingLayouts), (l) => l.key);
/** メールの描き方(レイアウトの鍵 → 描き方) */
export const layoutEmails: Readonly<Record<string, MessageLayoutEmailRenderer>> = keyedPlugs(gate.plugs(messagingLayoutEmails), (r) => r.layout);
