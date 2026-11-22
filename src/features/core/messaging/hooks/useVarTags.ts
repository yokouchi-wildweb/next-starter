// src/features/core/messaging/hooks/useVarTags.ts
// 埋め込み情報のタグ(部品 VarTags)の流れ: 一覧(lib の varCatalog が組んだ物)を共通(共通の一覧 + enricher)と専用に分け、
// 押したタグの {{別名}} をコピーして短い知らせを出す(useCopyMessageVariable、D78)。
// 戻り値の common / own / copy をそのまま部品に渡す。
// aliasOf / toAliases = 鍵 → 別名(D133): 画面に出す値の {{鍵}} を {{別名}} で見せる時に使う(別名の無い名前はそのまま)

"use client";

import { useCallback, useMemo } from "react";

import type { MessageVarCatalog, MessageVarEntry } from "@/lib/messaging";

import { useCopyMessageVariable } from "./useCopyMessageVariable";

export type UseVarTagsOptions = {
  /** 埋め込み情報の一覧(その連絡・テンプレートで書ける名前の全部) */
  catalog?: MessageVarCatalog | null;
};

const NO_ENTRIES: readonly MessageVarEntry[] = [];

// lib templateVariables の {{名前}} と同じ形
const VARIABLE = /\{\{([\p{L}\p{N}_]+)\}\}/gu;

/** 文の中の {{鍵}} を {{別名}} に(別名のある名前だけ)。escape = 別名を入れる前の加工(HTML に入れる時) */
export function replaceKeysWithAliases(text: string, aliases: ReadonlyMap<string, string>, escape: (alias: string) => string = (alias) => alias): string {
  if (aliases.size === 0 || !text.includes("{{")) return text;
  return text.replace(VARIABLE, (match, key: string) => {
    const alias = aliases.get(key);
    return alias ? `{{${escape(alias)}}}` : match;
  });
}

/** 値の中の文の全部(並び・組の中も)の {{鍵}} を {{別名}} に。文の無い値はそのまま */
export function valueWithAliases<T>(value: T, aliases: ReadonlyMap<string, string>): T {
  if (aliases.size === 0) return value;
  const walk = (item: unknown): unknown => {
    if (typeof item === "string") return replaceKeysWithAliases(item, aliases);
    if (Array.isArray(item)) return item.map(walk);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, inner]) => [key, walk(inner)]));
    return item;
  };
  return walk(value) as T;
}

export function useVarTags({ catalog }: UseVarTagsOptions) {
  const { common, own } = useMemo(() => {
    const entries = catalog ?? NO_ENTRIES;
    return {
      common: entries.filter((entry) => entry.source !== "own"),
      own: entries.filter((entry) => entry.source === "own"),
    };
  }, [catalog]);
  /** 鍵 → 別名(別名の無い鍵は入れない) */
  const aliases = useMemo(
    () => new Map((catalog ?? NO_ENTRIES).filter((entry) => entry.alias && entry.alias !== entry.key).map((entry) => [entry.key, entry.alias] as const)),
    [catalog],
  );
  const aliasOf = useCallback((key: string) => aliases.get(key) ?? key, [aliases]);
  const toAliases = useCallback(<T>(value: T): T => valueWithAliases(value, aliases), [aliases]);
  const copy = useCopyMessageVariable();
  return { common, own, copy, aliases, aliasOf, toAliases };
}
