// src/components/DataTable/RecordSelectionTable.tsx

"use client";

import React from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";

import { Checkbox } from "@/components/Shadcn/checkbox";
import { cn } from "@/lib/cn";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./Table";
import type { DataTableProps } from "./DataTable";

type SelectionBehavior = "row" | "checkbox";

export type RecordSelectionTableProps<T> = Omit<
  DataTableProps<T>,
  "rowClassName" | "onRowClick"
> & {
  rowClassName?: string | ((item: T, options: { selected: boolean }) => string);
  onRowClick?: (item: T) => void;
  selectedKeys?: React.Key[];
  defaultSelectedKeys?: React.Key[];
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
  selectionBehavior?: SelectionBehavior;
  selectColumnLabel?: string;
};

export default function RecordSelectionTable<T>({
  items = [],
  columns,
  getKey = (_, index) => index,
  rowClassName,
  onRowClick,
  emptyValueFallback,
  selectedKeys,
  defaultSelectedKeys = [],
  onSelectionChange,
  selectionBehavior = "row",
  selectColumnLabel = "選択",
}: RecordSelectionTableProps<T>) {
  const resolvedFallback = emptyValueFallback ?? "(未設定)";
  const renderCellContent = (content: React.ReactNode) => {
    if (content) {
      return content;
    }
    return (
      <span className="text-muted-foreground text-xs font-medium">{resolvedFallback}</span>
    );
  };

  const isControlled = selectedKeys !== undefined;
  const [uncontrolledKeys, setUncontrolledKeys] = React.useState<React.Key[]>(
    defaultSelectedKeys,
  );

  React.useEffect(() => {
    if (!isControlled) {
      setUncontrolledKeys(defaultSelectedKeys);
    }
  }, [defaultSelectedKeys, isControlled]);

  const resolvedSelectedKeys = isControlled ? selectedKeys! : uncontrolledKeys;
  const selectedKeySet = React.useMemo(() => new Set(resolvedSelectedKeys), [resolvedSelectedKeys]);

  const keyedItems = React.useMemo(
    () =>
      items.map((item, index) => ({
        item,
        index,
        key: getKey(item, index),
      })),
    [items, getKey],
  );

  const keyToItemMap = React.useMemo(() => {
    const map = new Map<React.Key, T>();
    keyedItems.forEach(({ key, item }) => {
      map.set(key, item);
    });
    return map;
  }, [keyedItems]);

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

  const resolveRowClassName = (item: T, selected: boolean) => {
    if (typeof rowClassName === "function") {
      return rowClassName(item, { selected });
    }
    return rowClassName;
  };

  const shouldHandleRowSelection = selectionBehavior === "row";
  const isCheckboxSelection = selectionBehavior === "checkbox";

  const handleRowClick = (item: T, key: React.Key) => {
    if (shouldHandleRowSelection) {
      updateKeySelection(key);
    }
    onRowClick?.(item);
  };

  const resolveCheckboxState = (state: boolean, indeterminate: boolean): CheckedState => {
    if (indeterminate) {
      return "indeterminate";
    }
    return state;
  };

  const isCheckboxEvent = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    return Boolean(target?.closest("[data-table-checkbox-root]"));
  };

  const handleSelectCellClick = (event: React.MouseEvent<HTMLElement>, key: React.Key) => {
    if (!isCheckboxSelection) {
      return;
    }
    event.stopPropagation();
    if (isCheckboxEvent(event)) {
      return;
    }
    updateKeySelection(key);
  };

  const handleSelectAllCellClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!isCheckboxSelection) {
      return;
    }
    event.stopPropagation();
    if (isCheckboxEvent(event)) {
      return;
    }
    updateAllSelection(!isAllSelected);
  };

  const resolvedSelectColumnLabel = selectColumnLabel || "選択";

  return (
    <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
      <Table variant="list">
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn(
                "w-10",
                isCheckboxSelection && "cursor-pointer select-none",
              )}
              onClick={isCheckboxSelection ? handleSelectAllCellClick : undefined}
            >
              <div className="flex h-full w-full items-center justify-center">
                <Checkbox
                  data-table-checkbox-root="true"
                  aria-label={`${resolvedSelectColumnLabel}を全て切り替える`}
                  checked={resolveCheckboxState(isAllSelected, isPartialSelection)}
                  onCheckedChange={(checked) => updateAllSelection(checked === true)}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </TableHead>
            {columns.map((col, idx) => (
              <TableHead key={idx}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {keyedItems.map(({ item, key }, itemIndex) => {
            const isSelected = selectedKeySet.has(key);
            const resolvedRowClass = resolveRowClassName(item, isSelected);
            const isClickableRow = shouldHandleRowSelection || Boolean(onRowClick);

            return (
              <TableRow
                key={key}
                className={cn(
                  "group",
                  isClickableRow && "cursor-pointer",
                  isSelected && "bg-muted/60",
                  resolvedRowClass,
                )}
                onClick={isClickableRow ? () => handleRowClick(item, key) : undefined}
                aria-selected={isSelected}
                data-selected={isSelected ? "true" : undefined}
              >
                <TableCell
                  className={cn(
                    "w-10",
                    isCheckboxSelection && "cursor-pointer select-none",
                  )}
                  onClick={
                    isCheckboxSelection ? (event) => handleSelectCellClick(event, key) : undefined
                  }
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <Checkbox
                      data-table-checkbox-root="true"
                      aria-label={`${resolvedSelectColumnLabel}${itemIndex + 1}行`}
                      checked={isSelected}
                      onCheckedChange={(checked) => updateKeySelection(key, checked === true)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </div>
                </TableCell>
                {columns.map((col, idx) => (
                  <TableCell key={idx}>{renderCellContent(col.render(item))}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
