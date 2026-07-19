// src/lib/tableSuite/shared/reorder/useTableReorder.ts

"use client";

import React from "react";

import type { DragEndEvent } from "@dnd-kit/core";

import type { ReorderableConfig, SortState } from "../../types";
import { computeGroupedReorderResult } from "./computeGroupedReorder";

/** ドラッグハンドルの表示状態 */
export type DragHandleState = "grab" | "sortLocked" | "disabled";

export type TableReorderState<T> = {
  /** reorderable が指定されているか（ハンドル列を描画するか） */
  enabled: boolean;
  /** ドラッグが実際に動作する状態か（マウント済み・disabled / カラムソート中でない） */
  active: boolean;
  /** items と同順の文字列ID配列（getKey ベース） */
  ids: string[];
  /** SortableContext に渡すID配列（行単位 disabled を除外） */
  sortableIds: string[];
  handleDragEnd: (event: DragEndEvent) => void;
  /** 行単位のドラッグ可否とハンドル表示状態を解決する */
  resolveRowReorder: (item: T) => { dragEnabled: boolean; handleState: DragHandleState };
};

/**
 * @dnd-kit はサーバーとクライアントで異なる aria 属性IDを生成するため、
 * マウント後にのみドラッグを有効化してハイドレーションエラーを防ぐ
 * （マウント前はハンドル列のみ表示され、リスナーが付かない）
 */
const useMounted = () => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
};

type UseTableReorderArgs<T> = {
  items: T[];
  getKey: (item: T, index: number) => React.Key;
  reorderable: ReorderableConfig<T> | undefined;
  /** 現在のカラムソート状態。適用中は並び替えを自動無効化する */
  sort: SortState | undefined;
};

/**
 * テーブル行並び替えの共有状態フック。
 * DataTable / RecordSelectionTable / EditableGridTable が共通で使用する。
 */
export function useTableReorder<T>({
  items,
  getKey,
  reorderable,
  sort,
}: UseTableReorderArgs<T>): TableReorderState<T> {
  const mounted = useMounted();
  const enabled = Boolean(reorderable);
  const sortLocked = enabled && Boolean(sort);
  const active = enabled && mounted && !reorderable?.disabled && !sortLocked;

  const ids = React.useMemo(
    () => items.map((item, index) => String(getKey(item, index))),
    [items, getKey],
  );

  const isItemDisabled = reorderable?.isItemDisabled;
  const sortableIds = React.useMemo(() => {
    if (!isItemDisabled) {
      return ids;
    }
    return ids.filter((_, index) => !isItemDisabled(items[index]));
  }, [ids, items, isItemDisabled]);

  const getGroup = reorderable?.getGroup;
  const onReorder = reorderable?.onReorder;

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active: dragged, over } = event;
      if (!over || !onReorder) {
        return;
      }
      const result = computeGroupedReorderResult({
        items,
        ids,
        activeId: String(dragged.id),
        overId: String(over.id),
        getGroup,
      });
      if (result) {
        onReorder(result);
      }
    },
    [items, ids, getGroup, onReorder],
  );

  const globallyDisabled = reorderable?.disabled;
  const resolveRowReorder = React.useCallback(
    (item: T): { dragEnabled: boolean; handleState: DragHandleState } => {
      if (sortLocked) {
        return { dragEnabled: false, handleState: "sortLocked" };
      }
      if (globallyDisabled || isItemDisabled?.(item)) {
        return { dragEnabled: false, handleState: "disabled" };
      }
      // マウント前は grab 表示のままリスナーだけ付けない（ちらつき防止）
      return { dragEnabled: active, handleState: "grab" };
    },
    [sortLocked, globallyDisabled, isItemDisabled, active],
  );

  return { enabled, active, ids, sortableIds, handleDragEnd, resolveRowReorder };
}
