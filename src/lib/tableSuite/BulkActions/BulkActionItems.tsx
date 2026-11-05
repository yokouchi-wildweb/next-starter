// src/lib/tableSuite/BulkActions/BulkActionItems.tsx
// 絞って並べた一括操作の項目を描くだけの部品(RecordSelectionTable の bulkActions に渡す)

"use client";

import type { BulkActionSelection } from "../RecordSelectionTable/components/BulkActionBar";
import type { BulkActionItem } from "./types";

export type BulkActionItemsProps<Row, Access = unknown> = {
  /** selectBulkActions で絞って並べた項目 */
  items: readonly BulkActionItem<Row, Access>[];
  selection: BulkActionSelection<Row>;
  /** 項目の操作が終わったとき(選択の解除の後に呼ぶ。一覧の再読み込みなど) */
  onDone?: () => void;
};

/**
 * @example
 * const actions = useMemo(() => selectBulkActions(adminBulkActions, { list: "general", can }), [can]);
 * <RecordSelectionTable bulkActions={(selection) => <BulkActionItems items={actions} selection={selection} />} />
 */
export function BulkActionItems<Row, Access = unknown>({ items, selection, onDone }: BulkActionItemsProps<Row, Access>) {
  const done = () => {
    selection.clear();
    onDone?.();
  };
  return (
    <>
      {items.map(({ key, Component }) => (
        <Component key={key} selection={selection} onDone={done} />
      ))}
    </>
  );
}
