// src/lib/tableSuite/RecordSelectionTable/hooks/useRecordSelection.ts
//
// 行の選択の状態(見た目を持たない)。RecordSelectionTable が使い、表の外(カードの一覧など)でも
// 入口(@/lib/tableSuite)から使える。制御(selectedKeys)/ 非制御(defaultSelectedKeys)の両方。
// 省略できる指定: canSelect(選べない行は個別でも全部でも選ばれない)、rangeSelect(shift で起点から今の行まで)

"use client";

import React from "react";

import type { BulkActionSelection } from "../components/BulkActionBar";

type ItemWithKey<T> = {
  item: T;
  index: number;
  key: React.Key;
};

export type UseRecordSelectionOptions<T> = {
  items: T[];
  getKey: (item: T, index: number) => React.Key;
  /** 制御するときの選択(渡すと内部の状態を持たない) */
  selectedKeys?: React.Key[];
  /** 非制御の初期の選択 */
  defaultSelectedKeys?: React.Key[];
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
  /** 選べる行か(false の行は選ばれず、全部の選択と「全部選んだか」の数にも入らない)。未指定 = 全部選べる */
  canSelect?: (item: T, index: number) => boolean;
  /** shift を押した切り替えで、前に切り替えた行(起点)から今の行までを同じ値にする @default false */
  rangeSelect?: boolean;
};

export type RecordSelectionToggleOptions = {
  /** 付ける / 外す(未指定 = 今の逆) */
  checked?: boolean;
  /** shift を押しているか(rangeSelect のとき範囲で切り替える) */
  shiftKey?: boolean;
};

const EMPTY_KEYS: React.Key[] = [];

export function useRecordSelection<T>({
  items,
  getKey,
  selectedKeys,
  defaultSelectedKeys = EMPTY_KEYS,
  onSelectionChange,
  canSelect,
  rangeSelect = false,
}: UseRecordSelectionOptions<T>) {
  const isControlled = selectedKeys !== undefined;
  const [uncontrolledKeys, setUncontrolledKeys] = React.useState<React.Key[]>(defaultSelectedKeys);
  // 範囲選択の起点(前に shift なしで切り替えた行)
  const anchorKeyRef = React.useRef<React.Key | null>(null);

  React.useEffect(() => {
    if (!isControlled) {
      setUncontrolledKeys(defaultSelectedKeys);
    }
  }, [defaultSelectedKeys, isControlled]);

  const keyedItems = React.useMemo<ItemWithKey<T>[]>(
    () =>
      items.map((item, index) => ({
        item,
        index,
        key: getKey(item, index),
      })),
    [getKey, items],
  );

  const keyToItemMap = React.useMemo(() => {
    const map = new Map<React.Key, T>();
    keyedItems.forEach(({ key, item }) => {
      map.set(key, item);
    });
    return map;
  }, [keyedItems]);

  const selectableItems = React.useMemo(
    () => (canSelect ? keyedItems.filter(({ item, index }) => canSelect(item, index)) : keyedItems),
    [canSelect, keyedItems],
  );
  const selectableKeySet = React.useMemo(() => new Set(selectableItems.map(({ key }) => key)), [selectableItems]);

  const resolvedSelectedKeys = isControlled ? selectedKeys! : uncontrolledKeys;
  const selectedKeySet = React.useMemo(() => new Set(resolvedSelectedKeys), [resolvedSelectedKeys]);

  const emitSelectionChange = React.useCallback(
    (nextKeys: React.Key[]) => {
      if (!isControlled) {
        setUncontrolledKeys(nextKeys);
      }

      if (!onSelectionChange) {
        return;
      }

      const rows = nextKeys
        .map((key) => keyToItemMap.get(key))
        .filter((value): value is T => Boolean(value));

      onSelectionChange(nextKeys, rows);
    },
    [isControlled, keyToItemMap, onSelectionChange],
  );

  const updateKeySelection = React.useCallback(
    (key: React.Key, checked?: boolean, options?: Pick<RecordSelectionToggleOptions, "shiftKey">) => {
      // canSelect があるときだけ選べない行を弾く(無いときは前と同じ: どのキーも切り替える)
      if (canSelect && !selectableKeySet.has(key)) {
        return;
      }
      const nextKeys = new Set(resolvedSelectedKeys);
      const nextValue = checked ?? !nextKeys.has(key);

      const anchorKey = anchorKeyRef.current;
      const anchorIndex = anchorKey === null ? -1 : keyedItems.findIndex((entry) => entry.key === anchorKey);
      const targetIndex = keyedItems.findIndex((entry) => entry.key === key);
      const rangeKeys =
        rangeSelect && options?.shiftKey && anchorIndex >= 0 && targetIndex >= 0
          ? keyedItems
              .slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
              .map((entry) => entry.key)
              .filter((rangeKey) => !canSelect || selectableKeySet.has(rangeKey))
          : [key];

      for (const rangeKey of rangeKeys) {
        if (nextValue) {
          nextKeys.add(rangeKey);
        } else {
          nextKeys.delete(rangeKey);
        }
      }
      anchorKeyRef.current = key;

      emitSelectionChange(Array.from(nextKeys));
    },
    [canSelect, emitSelectionChange, keyedItems, rangeSelect, resolvedSelectedKeys, selectableKeySet],
  );

  const updateAllSelection = React.useCallback(
    (shouldSelectAll: boolean) => {
      const nextKeys = shouldSelectAll ? selectableItems.map(({ key }) => key) : [];
      emitSelectionChange(nextKeys);
    },
    [emitSelectionChange, selectableItems],
  );

  const toggle = React.useCallback(
    (key: React.Key, options?: RecordSelectionToggleOptions) =>
      updateKeySelection(key, options?.checked, { shiftKey: options?.shiftKey }),
    [updateKeySelection],
  );
  const clear = React.useCallback(() => updateAllSelection(false), [updateAllSelection]);

  const selectableCount = selectableItems.length;
  const isAllSelected = selectableCount > 0 && selectableItems.every(({ key }) => selectedKeySet.has(key));
  const isPartialSelection = selectedKeySet.size > 0 && !isAllSelected;

  // 一括操作のバー(BulkActionBar)にそのまま渡せる形
  const bulkSelection = React.useMemo<BulkActionSelection<T>>(() => {
    const selectedKeysArray = Array.from(selectedKeySet);
    const selectedRows = keyedItems.filter(({ key }) => selectedKeySet.has(key)).map(({ item }) => item);
    return {
      selectedKeys: selectedKeysArray,
      selectedRows,
      selectedIds: selectedKeysArray.map((key) => String(key)),
      count: selectedKeysArray.length,
      clear,
    };
  }, [clear, keyedItems, selectedKeySet]);

  return {
    keyedItems,
    selectedKeySet,
    selectedKeys: bulkSelection.selectedKeys,
    selectedRows: bulkSelection.selectedRows,
    isAllSelected,
    isPartialSelection,
    isSelectable: (key: React.Key) => selectableKeySet.has(key),
    updateKeySelection,
    updateAllSelection,
    /** 選択をこの鍵の並びに置き換える(一部の行だけのすべて選択など) */
    replaceSelection: emitSelectionChange,
    toggle,
    toggleAll: updateAllSelection,
    clear,
    bulkSelection,
  };
}
