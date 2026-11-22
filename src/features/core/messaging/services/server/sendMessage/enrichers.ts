// src/features/core/messaging/services/server/sendMessage/enrichers.ts
//
// その連絡に当たる enrichers の選び方(当て先 = 連絡の鍵・カテゴリー・種別・全部、D127)。使える名前の検査(definition.ts)と
// 実行(context.ts)と差し込みの別名(content.ts)が同じこの選び方を使う。lib/messaging だけに依る(送る口の中の import の輪を作らない)

import {
  varCatalog,
  enricherTargets,
  type MessageVarEntry,
  type MessageNamedVar,
  type MessageEnricher,
  type MessageKind,
} from "@/lib/messaging";

/** その連絡(鍵・カテゴリー・種別)に当たる enrichers */
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
): MessageVarEntry[] {
  const entries: MessageVarEntry[] = [];
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

/** 定義の varNames(D133)→ 一覧の名前(鍵が taken の vars = 共通・enrichers と同じ値は除く。名前の無い鍵も除く) */
function varNamesOf(message: { vars?: unknown; varNames?: unknown }, taken: ReadonlySet<string>): MessageNamedVar[] {
  const names = (message.varNames ?? {}) as Readonly<Record<string, { alias?: unknown; description?: unknown } | undefined>>;
  return varKeysOf(message).flatMap((key) => {
    const name = names[key];
    if (taken.has(key) || !name || typeof name.alias !== "string" || name.alias === "") return [];
    return [{ key, alias: name.alias, description: typeof name.description === "string" ? name.description : "" }];
  });
}

/**
 * その連絡で見える共通・enrichers の名前(共通 + 当たる enrichers + enricher と同じ鍵の vars)。vars の名前は入れない
 * (定義の検査が vars の別名の重なりを照らす相手、definition.ts)
 */
export function messageSharedVars(
  message: { key: string; category: string; kind: MessageKind; throttle?: unknown; vars?: unknown },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageVarEntry[] {
  const base = varCatalog({ enrichers: enrichersFor(message, enrichers), throttle: Boolean(message.throttle) });
  return [...base, ...varEnricherEntries(message, enrichers, new Set(base.map((entry) => entry.key)))];
}

/**
 * その連絡の埋め込み情報の一覧(共通 + 当たる enrichers + enricher と同じ鍵の vars + 残りの vars の名前 = 専用、D133)。
 * 差し込みの別名の表(送る口・プレビュー・組み直し)・管理画面のタグに使う。秘密の vars も入る(管理画面は呼び手が除く)
 */
export function messageVarCatalog(
  message: { key: string; category: string; kind: MessageKind; throttle?: unknown; vars?: unknown; varNames?: unknown },
  enrichers: Readonly<Record<string, MessageEnricher>>,
): MessageVarEntry[] {
  const shared = messageSharedVars(message, enrichers);
  const vars = varNamesOf(message, new Set(shared.map((entry) => entry.key)));
  return [...shared, ...varCatalog({ vars }).filter((entry) => entry.source === "own")];
}
