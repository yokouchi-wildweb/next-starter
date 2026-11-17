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

/** 連絡の vars の鍵(vars が zod の object の時) */
function varKeysOf(message: { vars?: unknown }): string[] {
  const shape = (message.vars as { shape?: Record<string, unknown> } | undefined)?.shape;
  return shape ? Object.keys(shape) : [];
}

/**
 * vars のうち enricher の provides と同じ鍵の物(呼び手が自分で渡す値。例 wallet の displayName)を、その enricher の別名つきの
 * 共通の埋め込み情報として扱う(当て先に当たらない enricher でも、同じ値の名前は同じ別名で書ける)
 */
function varEnricherEntries(
  message: { vars?: unknown },
  enrichers: Readonly<Record<string, MessageEnricher>>,
  taken: ReadonlySet<string>,
): MessageEmbeddedEntry[] {
  const entries: MessageEmbeddedEntry[] = [];
  for (const key of varKeysOf(message)) {
    if (taken.has(key)) continue;
    const enricher = Object.values(enrichers).find((item) => key in (item.provides.shape as Record<string, unknown>) && item.aliases?.[key]);
    if (enricher) entries.push({ key, alias: enricher.aliases[key]!, source: "enricher", enricher: enricher.key });
  }
  return entries;
}

/** その連絡に当たる enrichers の provides の鍵と日本語の別名({{鍵}} / {{別名}} で使える、D126) */
export function enricherKeysFor(
  message: { key: string; category: string; kind: MessageKind; vars?: unknown },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): string[] {
  const names = enrichersFor(message, enrichers).flatMap((enricher) => {
    const keys = Object.keys(enricher.provides.shape as Record<string, unknown>);
    return [...keys, ...keys.flatMap((key) => (enricher.aliases?.[key] ? [enricher.aliases[key]] : []))];
  });
  // vars のうち enricher と同じ鍵の値の別名(例 wallet の displayName = 表示名)
  return [...names, ...varEnricherEntries(message, enrichers, new Set(names)).map((entry) => entry.alias)];
}

/** その連絡の埋め込み情報の一覧(共通 + 当たる enrichers + enricher と同じ鍵の vars。差し込みの別名の表・管理画面のタグに使う) */
export function messageEmbeddedCatalog(
  message: { key: string; category: string; kind: MessageKind; throttle?: unknown; vars?: unknown },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageEmbeddedEntry[] {
  const base = embeddedCatalog({ enrichers: enrichersFor(message, enrichers), throttle: Boolean(message.throttle) });
  return [...base, ...varEnricherEntries(message, enrichers, new Set(base.map((entry) => entry.key)))];
}
