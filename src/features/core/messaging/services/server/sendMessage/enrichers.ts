// src/features/core/messaging/services/server/sendMessage/enrichers.ts
//
// その連絡に当たる enrichers の選び方(当て先 = 連絡の鍵・種類・種別・全部、D127)。使える鍵の検査(definition.ts)と
// 実行(context.ts)が同じこの選び方を使う。lib/messaging だけに依る(送る口の中の import の輪を作らない)

import { enricherTargets, type MessageEnricher, type MessageKind } from "@/lib/messaging";

/** その連絡(鍵・種類・種別)に当たる enrichers */
export function enrichersFor(
  message: { key: string; category: string; kind: MessageKind },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageEnricher[] {
  return Object.values(enrichers).filter((enricher) => enricherTargets(enricher.target, message));
}

/** その連絡に当たる enrichers の provides の鍵({{鍵}} で使える) */
export function enricherKeysFor(
  message: { key: string; category: string; kind: MessageKind },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): string[] {
  return enrichersFor(message, enrichers).flatMap((enricher) => Object.keys(enricher.provides.shape as Record<string, unknown>));
}
