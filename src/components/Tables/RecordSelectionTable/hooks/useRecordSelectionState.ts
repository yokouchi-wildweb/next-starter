import React from "react";

type ItemWithKey<T> = {
  item: T;
  index: number;
  key: React.Key;
};

type UseRecordSelectionStateParams<T> = {
  items: T[];
  getKey: (item: T, index: number) => React.Key;
  selectedKeys?: React.Key[];
  defaultSelectedKeys: React.Key[];
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
};

export function useRecordSelectionState<T>({
  items,
  getKey,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
}: UseRecordSelectionStateParams<T>) {
  const isControlled = selectedKeys !== undefined;
  const [uncontrolledKeys, setUncontrolledKeys] = React.useState<React.Key[]>(defaultSelectedKeys);

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
    (key: React.Key, checked?: boolean) => {
      const nextKeys = new Set(resolvedSelectedKeys);
      const nextValue = checked ?? !nextKeys.has(key);

      if (nextValue) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }

      emitSelectionChange(Array.from(nextKeys));
    },
    [emitSelectionChange, resolvedSelectedKeys],
  );

  const updateAllSelection = React.useCallback(
    (shouldSelectAll: boolean) => {
      const nextKeys = shouldSelectAll ? keyedItems.map(({ key }) => key) : [];
      emitSelectionChange(nextKeys);
    },
    [emitSelectionChange, keyedItems],
  );

  const selectableCount = keyedItems.length;
  const isAllSelected = selectableCount > 0 && keyedItems.every(({ key }) => selectedKeySet.has(key));
  const isPartialSelection = selectedKeySet.size > 0 && !isAllSelected;

  return {
    keyedItems,
    selectedKeySet,
    isAllSelected,
    isPartialSelection,
    updateKeySelection,
    updateAllSelection,
  };
}
