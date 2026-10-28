"use client";

import useSWR, { type SWRConfiguration } from "swr";

import type { CollectionEntry } from "@/lib/crud/collections/collectionEntries";
import { fetchCollectionEntries, type CollectionEntriesByParent } from "@/lib/crud/client/collectionEntries";
import type { HttpError } from "@/lib/errors";

/**
 * 主の集まりをエントリ（従属の行 id 付き）で読む。集まりの 1 件を FK（従属の行 id）で選ぶ画面用。
 * parentIds が空ならリクエストしない。data = 主の id → エントリの並び、entriesOf(id) で 1 つの主の並び
 * @param domain 主のドメイン（例: "sample"）
 * @param field 主の集まりの項目名（例: "images"）
 * @param parentIds 主の id（1 つでも複数でもよい。100 件まで）
 */
export function useCollectionEntries(
  domain: string,
  field: string,
  parentIds: string | readonly string[] | null | undefined,
  config?: SWRConfiguration<CollectionEntriesByParent, HttpError>,
) {
  const ids = (Array.isArray(parentIds) ? parentIds : parentIds ? [parentIds] : []).filter(Boolean) as string[];
  const key = ids.length ? ["collection-entries", domain, field, ...[...ids].sort()].join(":") : null;
  const { data, error, isLoading, mutate } = useSWR<CollectionEntriesByParent, HttpError>(
    key,
    () => fetchCollectionEntries(domain, field, ids),
    config,
  );
  const entriesOf = (parentId: string): CollectionEntry[] => data?.[parentId] ?? [];
  return { data, entriesOf, isLoading, error, mutate };
}
