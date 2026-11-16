// src/lib/tableSuite/RecordSelectionList/index.tsx
//
// RecordSelectionTable のカードの一覧の兄弟(D95)。選択の状態(useRecordSelectionState)・一括操作のバー(BulkActionBar)・
// 選択の出し方(selectionMode、D97 D98)・無限スクロールの番兵は表と同じ物を使う。
// - 1 件 = 左のチェックの列 + カードの本体(renderItem)。チェックの列は全高・押しやすい幅で、列のどこを押しても選択が切り替わる(D99)。
//   キーボードと aria はチェックボックスのまま(列はマウスの当たりを広げるだけ)
// - 選択の on / off(toggle)ではチェックの列が幅と濃さで出入りする(一括操作のバーと同じ 600ms ease-out)
// - 見出しの行が無いので「すべて選択」はバーの左に出す(読み込み済みの選べる行が対象)
// - isSelectable(item) が false の行はチェックを出さず、すべて選択からも外す

"use client";

import React from "react";

import { Checkbox } from "@/components/Primitives/Checkbox";
import { cn } from "@/lib/cn";

import { BulkActionBar, type BulkActionBarPosition, type BulkActionBarSpacing, type BulkActionSelection } from "../RecordSelectionTable/components/BulkActionBar";
import { useRecordSelectionState } from "../RecordSelectionTable/hooks/useRecordSelectionState";
import { useSelectionMode, type SelectionMode } from "../RecordSelectionTable/hooks/useSelectionMode";
import { isCheckboxEvent } from "../RecordSelectionTable/utils/checkboxEvent";

const EMPTY_KEYS: React.Key[] = [];

export type RecordSelectionListProps<T> = {
  items?: T[];
  getKey?: (item: T, index: number) => React.Key;
  /** カードの本体 */
  renderItem: (item: T, context: { selected: boolean; index: number }) => React.ReactNode;
  /** 選べる行か(false = チェックを出さず、すべて選択からも外す) @default 全部選べる */
  isSelectable?: (item: T) => boolean;
  selectedKeys?: React.Key[];
  defaultSelectedKeys?: React.Key[];
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
  /** 選択の出し方 @default "onSelect" */
  selectionMode?: SelectionMode;
  /** チェックの aria-label(行の番号を後ろに付ける) @default "選択" */
  selectLabel?: string;
  /** 一括操作バーのアクション(BulkActionItems など)。指定するとバーを出す */
  bulkActions?: (selection: BulkActionSelection<T>) => React.ReactNode;
  bulkActionsSpacing?: BulkActionBarSpacing;
  bulkActionsPosition?: BulkActionBarPosition;
  bulkActionsEmptyMessage?: string;
  bulkActionsSticky?: boolean;
  /** 無限スクロールの番兵(useInfiniteScrollQuery の sentinelRef) */
  bottomSentinelRef?: React.Ref<HTMLDivElement>;
  /** 0 件の時に出す物 */
  emptyNode?: React.ReactNode;
  className?: string;
};

export default function RecordSelectionList<T>({
  items = [],
  getKey = (_, index) => index,
  renderItem,
  isSelectable,
  selectedKeys,
  defaultSelectedKeys = EMPTY_KEYS,
  onSelectionChange,
  selectionMode = "onSelect",
  selectLabel = "選択",
  bulkActions,
  bulkActionsSpacing,
  bulkActionsPosition = "top",
  bulkActionsEmptyMessage,
  bulkActionsSticky,
  bottomSentinelRef,
  emptyNode = null,
  className,
}: RecordSelectionListProps<T>) {
  const { keyedItems, selectedKeySet, updateKeySelection, replaceSelection } = useRecordSelectionState({
    items,
    getKey,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
  });

  const selectableKeys = React.useMemo(
    () => keyedItems.filter(({ item }) => !isSelectable || isSelectable(item)).map(({ key }) => key),
    [keyedItems, isSelectable],
  );
  const selectedSelectable = selectableKeys.filter((key) => selectedKeySet.has(key));
  const isAllSelected = selectableKeys.length > 0 && selectedSelectable.length === selectableKeys.length;
  const isPartialSelection = selectedSelectable.length > 0 && !isAllSelected;

  // すべて選択・解除(選べる行だけ。選べない行の選択はそのまま残さない)
  const setAll = React.useCallback((checked: boolean) => replaceSelection(checked ? selectableKeys : []), [replaceSelection, selectableKeys]);
  const clear = React.useCallback(() => setAll(false), [setAll]);
  const { selectionOn, setSelectionOn } = useSelectionMode(selectionMode, clear);

  const selection = React.useMemo<BulkActionSelection<T>>(() => {
    const keys = Array.from(selectedKeySet);
    return {
      selectedKeys: keys,
      selectedRows: keyedItems.filter(({ key }) => selectedKeySet.has(key)).map(({ item }) => item),
      selectedIds: keys.map((key) => String(key)),
      count: keys.length,
      clear,
    };
  }, [keyedItems, selectedKeySet, clear]);

  const bar = (placement: "top" | "bottom") =>
    bulkActions ? (
      <BulkActionBar
        selection={selection}
        bulkActions={bulkActions}
        spacing={bulkActionsSpacing}
        placement={placement}
        mode={selectionMode}
        selectionOn={selectionOn}
        onSelectionOnChange={setSelectionOn}
        selectAll={{ checked: isAllSelected, indeterminate: isPartialSelection, onToggle: setAll }}
        emptyMessage={bulkActionsEmptyMessage}
        sticky={bulkActionsSticky}
      />
    ) : null;

  return (
    <>
      {bulkActionsPosition === "top" || bulkActionsPosition === "both" ? bar("top") : null}
      <div className={cn("flex w-full flex-col gap-2", className)} data-slot="record-selection-list">
        {keyedItems.length === 0 ? emptyNode : null}
        {keyedItems.map(({ item, key, index }) => {
          const selectable = !isSelectable || isSelectable(item);
          const selected = selectedKeySet.has(key);
          return (
            <div key={key} className="flex items-stretch" data-selected={selected ? "true" : undefined}>
              {/* チェックの列はいつも置き、選択の on / off で幅と濃さを動かす(一括操作のバーと同じ 600ms ease-out)。
                  off の間は inert(押せない・フォーカスしない・読み上げない) */}
              <div
                className={cn(
                  "shrink-0 overflow-hidden transition-[width,margin,opacity] duration-[600ms] ease-out",
                  selectionOn ? "mr-1 w-11 opacity-100" : "mr-0 w-0 opacity-0",
                )}
                inert={!selectionOn}
                aria-hidden={selectionOn ? undefined : true}
              >
                {selectable ? (
                  // 列全体を押すと切り替わる(チェックそのものを押した時は二重にしない)
                  <div
                    className="flex h-full w-11 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted/60"
                    onClick={(event) => {
                      if (!selectionOn || isCheckboxEvent(event)) return;
                      updateKeySelection(key);
                    }}
                    data-slot="record-selection-list-check"
                  >
                    <Checkbox
                      data-table-checkbox-root="true"
                      aria-label={`${selectLabel}${index + 1}件目`}
                      checked={selected}
                      onCheckedChange={(checked) => updateKeySelection(key, checked === true)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">{renderItem(item, { selected, index })}</div>
            </div>
          );
        })}
        {bottomSentinelRef ? <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" /> : null}
      </div>
      {bulkActionsPosition === "bottom" || bulkActionsPosition === "both" ? bar("bottom") : null}
    </>
  );
}
