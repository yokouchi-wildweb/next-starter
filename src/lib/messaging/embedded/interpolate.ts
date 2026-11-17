// src/lib/messaging/embedded/interpolate.ts
//
// 文面の埋め込み情報: {{鍵}} と {{別名}} を同じ値で埋める。差し込みの書式は lib/structuredDocument の 1 本(replaceVariables・listVariables)。
// - findEmbedded: 文面に書かれた名前を鍵に直して並べる(出てくる順・重複なし)。一覧に無い名前は unknown(保存・送る前に拒む)
// - embeddedVariableMap: 鍵 → 値 の表に別名の行を足す(replaceVariables に渡す)

import { listVariables, type VariableMap } from "@/lib/structuredDocument/shared";

import { resolveEmbeddedName, type MessageEmbeddedCatalog } from "./catalog";

/** 文面(文字・並び・object の中の文字の全部)に書かれた埋め込み情報: 鍵に直した名前と、一覧に無い名前 */
export function findEmbedded(value: unknown, catalog: MessageEmbeddedCatalog): { keys: string[]; unknown: string[] } {
  const keys: string[] = [];
  const unknown: string[] = [];
  const visit = (item: unknown) => {
    if (typeof item === "string") {
      for (const name of listVariables(item)) {
        const key = resolveEmbeddedName(catalog, name);
        if (key === null) {
          if (!unknown.includes(name)) unknown.push(name);
        } else if (!keys.includes(key)) keys.push(key);
      }
    } else if (Array.isArray(item)) item.forEach(visit);
    else if (item && typeof item === "object") Object.values(item).forEach(visit);
  };
  visit(value);
  return { keys, unknown };
}

/** 鍵 → 値 の表に、一覧の別名 → 同じ値 の行を足す(値の無い鍵の別名は足さない = 書いたまま残る) */
export function embeddedVariableMap(values: Readonly<Record<string, string>>, catalog: MessageEmbeddedCatalog): VariableMap {
  const map: VariableMap = { ...values };
  for (const entry of catalog) {
    if (entry.alias && entry.key in values && !(entry.alias in map)) map[entry.alias] = values[entry.key]!;
  }
  return map;
}
