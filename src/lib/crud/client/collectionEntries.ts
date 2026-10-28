// src/lib/crud/client/collectionEntries.ts
//
// 主の集まりをエントリ（従属の行 id 付き）で読む client service（GET /api/<domain>/collection-entries）。
// どの主ドメインにも使える汎用の 1 つ（ドメインごとの生成は無い）。UI からは hooks の useCollectionEntries を使う

import axios from "axios";

import type { CollectionEntry } from "@/lib/crud/collections/collectionEntries";
import { normalizeHttpError } from "@/lib/errors";

/** 主の id → エントリの並び */
export type CollectionEntriesByParent = Record<string, CollectionEntry[]>;

/**
 * @param domain 主のドメイン（登録表のキー、例: "sample"）
 * @param field 主の集まりの項目名（例: "images"）
 * @param parentIds 主の id（100 件まで）
 */
export async function fetchCollectionEntries(
  domain: string,
  field: string,
  parentIds: readonly string[],
): Promise<CollectionEntriesByParent> {
  try {
    const response = await axios.get<CollectionEntriesByParent>(`/api/${domain}/collection-entries`, {
      params: { field, parentIds: parentIds.join(",") },
    });
    return response.data;
  } catch (error) {
    throw normalizeHttpError(error);
  }
}
