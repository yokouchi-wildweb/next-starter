"use client";

// 編集画面の「前後の項目へ移る」のデータの hook。候補(検索の先頭の数件 + 今の項目)・移る先のパス・表示名を返す。
// 表示は棚の ItemNavigator(@/components/AppFrames/Admin/Elements/ItemNavigator、props だけ)、置き場はルートの画面
// (編集のルートの _screen の client の部品が呼び、Screen が <AdminPage actions> に置く)。
// lib/crud は features を読まないので、ドメインは呼ぶ側が domainDisplay(<domain>/entities/display.ts)で渡す。
// 取得は汎用の /api/<domain> の search(DuplicateButton と同じ作り)、パスは getAdminPaths(display.plural).edit。

import { useCallback, useMemo } from "react";

import type { DomainDisplay } from "@/lib/domain/types/display";
import { createApiClient } from "@/lib/crud/client";
import { getAdminPaths } from "@/lib/crud/utils/paths";

import { useSearchDomain } from "./useSearchDomain";
import { itemLabelOf, withCurrentItem } from "./internal/itemNavigation";

export type UseDomainItemNavigationOptions<T extends { id: string }> = {
  /** ドメインの表示用の写し(<domain>/entities/display.ts の domainDisplay) */
  domain: Pick<DomainDisplay, "singular" | "plural">;
  /** 今の項目(候補に無ければ先頭に足す) */
  current: T;
  /** 表示名に使う列。省略 = name → title → id */
  labelField?: keyof T & string;
  /** 候補の数(検索の既定の並びの先頭から)。既定 10 */
  limit?: number;
};

export type DomainItemNavigation<T extends { id: string }> = {
  /** 候補(今の項目を含む) */
  items: T[];
  /** 今の項目の id */
  currentId: string;
  /** 移る先のパス(管理の編集画面) */
  getPath: (id: string) => string;
  /** 候補の表示名 */
  getLabel: (item: T) => string;
  /** 候補を読み込み中か */
  isLoading: boolean;
};

export function useDomainItemNavigation<T extends { id: string }>({
  domain,
  current,
  labelField,
  limit = 10,
}: UseDomainItemNavigationOptions<T>): DomainItemNavigation<T> {
  const client = useMemo(() => createApiClient<T>(`/api/${domain.singular}`), [domain.singular]);
  const search = client.search;
  if (!search) {
    throw new Error(`${domain.singular} の検索が使えません`);
  }
  const { data, isLoading } = useSearchDomain<T, { limit: number }>(`${domain.plural}/search`, search, { limit });

  const getPath = useMemo(() => getAdminPaths(domain.plural).edit, [domain.plural]);
  const getLabel = useCallback((item: T) => itemLabelOf(item, labelField), [labelField]);
  const items = useMemo(() => withCurrentItem(data, current), [data, current]);

  return { items, currentId: current.id, getPath, getLabel, isLoading };
}
