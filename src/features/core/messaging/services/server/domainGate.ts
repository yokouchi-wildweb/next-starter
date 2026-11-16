// src/features/core/messaging/services/server/domainGate.ts
// 連絡はその定義のフォルダのドメインに属する(生成の一覧の鍵 <ドメインのフォルダ名>.<ファイル名>)。
// ドメインが門で閉じていれば、その連絡は文言の編集に出さず・直せず・送らない(上流も fork のドメインも同じ。D77)

import { gate } from "@/featureGate";

/** 連絡の鍵のドメイン(最初の "." の前) */
export function messageDomainOf(messageKey: string): string {
  const dot = messageKey.indexOf(".");
  return dot > 0 ? messageKey.slice(0, dot) : messageKey;
}

/** 連絡のドメインが開いているか(どの規則にも載らないドメインは常に開) */
export function messageDomainOpen(messageKey: string): boolean {
  return gate.domainOpen(messageDomainOf(messageKey));
}
