// src/features/core/messaging/services/server/domainGate.ts
// 門番(D22・D77): 連絡と記録の宛先は、置いたフォルダのドメインに属する。ドメインが門で閉じていれば使わない(上流も fork のドメインも同じ)。
// - 連絡: 生成の一覧の鍵 <ドメインのフォルダ名>.<ファイル名>。閉じていればテキストの編集に出さず・直せず・送らない
// - 記録の宛先: 生成の一覧(src/registry/recordTargetRegistry.ts、絞らない)の項目の domain。読み手は全部 loadRecordTarget を通す

import { gate } from "@/featureGate";
import type { MessageRecordTarget, MessageRecordTargetRegistry, MessageRecordTargetRegistryEntry } from "@/lib/messaging";

/** 連絡の鍵のドメイン(最初の "." の前) */
export function messageDomainOf(messageKey: string): string {
  const dot = messageKey.indexOf(".");
  return dot > 0 ? messageKey.slice(0, dot) : messageKey;
}

/** 連絡のドメインが開いているか(どの規則にも載らないドメインは常に開) */
export function messageDomainOpen(messageKey: string): boolean {
  return gate.domainOpen(messageDomainOf(messageKey));
}

/** 記録の宛先の項目のドメインが開いているか(門番。どの規則にも載らないドメインは常に開) */
export function recordTargetOpen(entry: Pick<MessageRecordTargetRegistryEntry, "domain">): boolean {
  return gate.domainOpen(entry.domain);
}

/**
 * 記録の宛先を鍵で読む(読み手の唯一の口。隣の上書きの messages を重ねる)。無い鍵・閉じたドメイン(recordTargetOpen)・項目の enabled() が false = null
 */
export async function loadRecordTarget(registry: MessageRecordTargetRegistry, key: string): Promise<MessageRecordTarget | null> {
  const entry = Object.hasOwn(registry, key) ? registry[key] : undefined;
  if (!entry || !recordTargetOpen(entry)) return null;
  const [{ recordTarget }, overridden] = await Promise.all([entry.target(), entry.override?.()]);
  if (recordTarget.enabled && !recordTarget.enabled()) return null;
  // 隣の <名前>.override.ts が変えられるのは messages だけ(鍵の検査は pnpm check extensions)
  const messages = overridden?.recordTargetOverride?.messages;
  return messages ? { ...recordTarget, messages } : recordTarget;
}
