// src/features/core/messaging/services/server/sendMessage/enrichers.ts
//
// その連絡に当たる enrichers の選び方(当て先 = 連絡の鍵・種類・種別・全部、D127)。使える名前の検査(definition.ts)と
// 実行(context.ts)と差し込みの別名(content.ts)が同じこの選び方を使う。lib/messaging だけに依る(送る口の中の import の輪を作らない)

import { embeddedCatalog, enricherTargets, type MessageEmbeddedEntry, type MessageEnricher, type MessageKind } from "@/lib/messaging";

/** その連絡(鍵・種類・種別)に当たる enrichers */
export function enrichersFor(
  message: { key: string; category: string; kind: MessageKind },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageEnricher[] {
  return Object.values(enrichers).filter((enricher) => enricherTargets(enricher.target, message));
}

/** その連絡に当たる enrichers の provides の鍵と日本語の別名({{鍵}} / {{別名}} で使える、D126) */
export function enricherKeysFor(
  message: { key: string; category: string; kind: MessageKind },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): string[] {
  return enrichersFor(message, enrichers).flatMap((enricher) => {
    const keys = Object.keys(enricher.provides.shape as Record<string, unknown>);
    return [...keys, ...keys.flatMap((key) => (enricher.aliases?.[key] ? [enricher.aliases[key]] : []))];
  });
}

/** その連絡の埋め込み情報の一覧(共通 + 当たる enrichers。差し込みの別名の表に使う) */
export function messageEmbeddedCatalog(
  message: { key: string; category: string; kind: MessageKind; throttle?: unknown },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageEmbeddedEntry[] {
  return embeddedCatalog({ enrichers: enrichersFor(message, enrichers), throttle: Boolean(message.throttle) });
}
