// src/lib/tableSuite/BulkActions/selectBulkActions.ts
// 一括操作の項目を、容器の一覧に出す物だけに絞って並べる(純関数)

import type { BulkActionItem, SelectBulkActionsOptions } from "./types";

/** order を省いた項目の並び */
export const DEFAULT_BULK_ACTION_ORDER = 100;

const isEnabled = (enabled: BulkActionItem<unknown>["enabled"]) =>
  enabled === undefined ? true : typeof enabled === "function" ? enabled() : enabled;

/**
 * 絞る: enabled が偽の項目・lists に容器の一覧が無い項目・can が許さない access の項目を外す。
 * 並べる: order の小さい順、同じなら key の順。key の重複は例外(受け口の項目の名前は一意)
 */
export function selectBulkActions<Row, Access = unknown>(
  items: readonly BulkActionItem<Row, Access>[],
  { list, can }: SelectBulkActionsOptions<Access> = {},
): BulkActionItem<Row, Access>[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.key)) throw new Error(`一括操作の項目の key "${item.key}" が重複しています`);
    seen.add(item.key);
  }
  return items
    .filter((item) => isEnabled(item.enabled))
    .filter((item) => item.lists === undefined || (list !== undefined && item.lists.includes(list)))
    .filter((item) => item.access === undefined || (can !== undefined && can(item.access)))
    .sort(
      (a, b) =>
        (a.order ?? DEFAULT_BULK_ACTION_ORDER) - (b.order ?? DEFAULT_BULK_ACTION_ORDER) ||
        (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    );
}
