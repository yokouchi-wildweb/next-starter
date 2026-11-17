// src/features/core/messaging/hooks/useEmbeddedInfoTags.ts
// 埋め込み情報のタグ(部品 EmbeddedInfoTags)の流れ: 一覧(lib の embeddedCatalog が組んだ物)を共通(共通の一覧 + enricher)と専用に分け、
// 押したタグの {{別名}} をコピーして短い知らせを出す(useCopyMessageVariable、D78)。
// 戻り値の common / own / copy をそのまま部品に渡す

"use client";

import { useMemo } from "react";

import type { MessageEmbeddedCatalog, MessageEmbeddedEntry } from "@/lib/messaging";

import { useCopyMessageVariable } from "./useCopyMessageVariable";

export type UseEmbeddedInfoTagsOptions = {
  /** 埋め込み情報の一覧(その連絡・テンプレートで書ける名前の全部) */
  catalog?: MessageEmbeddedCatalog | null;
};

const NO_ENTRIES: readonly MessageEmbeddedEntry[] = [];

export function useEmbeddedInfoTags({ catalog }: UseEmbeddedInfoTagsOptions) {
  const { common, own } = useMemo(() => {
    const entries = catalog ?? NO_ENTRIES;
    return {
      common: entries.filter((entry) => entry.source !== "own"),
      own: entries.filter((entry) => entry.source === "own"),
    };
  }, [catalog]);
  const copy = useCopyMessageVariable();
  return { common, own, copy };
}
