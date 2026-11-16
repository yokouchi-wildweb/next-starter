"use client";

// src/features/core/messaging/hooks/useAdminDispatchSelection.ts
//
// 管理: 回の一覧の選択とまとめての削除(D88。入れ物 AdminDispatchList はこれを呼んで部品を並べるだけ)。
// - 選べるのは読み込み済みの削除していない回。「全部を選ぶ」= 読み込み済みの行(無限スクロールの続きは含めない)
// - 1 回に削除できるのは ADMIN_DELETE_MAX_IDS(100)件まで。超えたら削除のボタンを押せない(overLimit)
// - 確認を開いている間だけ削除の見込み(delete-summary)を取る
// - 削除した回は一覧から外す(removeItems、続きの位置はずれない)。結果は知らせ(削除 N 件・失敗 M 件)、選択を空に戻す

import { useCallback, useMemo, useState } from "react";

import { useDomainMutation } from "@/lib/crud/hooks";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import {
  bulkDeleteAdminDispatches,
  type AdminBulkDeleteResult,
  type AdminDispatchSummary,
} from "../services/client/adminMessagingClient";

import { ADMIN_DISPATCHES_KEY } from "./adminMessagingKeys";
import { useDispatchDeleteSummary } from "./useDispatchDeleteSummary";

/** 1 回に削除できる回の数(サーバーの ADMIN_DELETE_MAX_IDS と同じ) */
export const DISPATCH_DELETE_MAX = 100;

export type UseAdminDispatchSelectionOptions = {
  items: readonly AdminDispatchSummary[];
  removeItems: (predicate: (item: AdminDispatchSummary) => boolean) => void;
};

export function useAdminDispatchSelection({ items, removeItems }: UseAdminDispatchSelectionOptions) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  /** 選べる回(削除していない回) */
  const selectable = useCallback((item: AdminDispatchSummary) => !item.deletedAt, []);
  // 一覧から消えた回は選択からも外す(絞りを変えた時など)
  const ids = useMemo(() => items.filter((item) => selected.has(item.id) && selectable(item)).map((item) => item.id), [items, selected, selectable]);

  const toggle = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const selectAllLoaded = useCallback(() => setSelected(new Set(items.filter(selectable).map((item) => item.id))), [items, selectable]);
  const clear = useCallback(() => setSelected(new Set()), []);

  const { summary, error: summaryError, isLoading: summaryLoading } = useDispatchDeleteSummary(ids, confirmOpen);

  const mutation = useDomainMutation<AdminBulkDeleteResult, readonly string[]>(
    `${ADMIN_DISPATCHES_KEY}/bulk-delete`,
    (input) => bulkDeleteAdminDispatches(input),
    [ADMIN_DISPATCHES_KEY],
  );

  /** 選んだ回を削除する(確認の Dialog の onConfirm。Promise の間 loading) */
  const remove = useCallback(async () => {
    try {
      const res = await mutation.trigger(ids);
      const done = new Set(res.results.filter((item) => item.ok).map((item) => item.dispatchId));
      const failed = res.results.length - done.size;
      removeItems((item) => done.has(item.id));
      setSelected(new Set());
      setConfirmOpen(false);
      showToast(failed > 0 ? `${done.size} 件を削除しました(${failed} 件は削除できませんでした)` : `${done.size} 件を削除しました`, failed > 0 ? "warning" : "success");
    } catch (e) {
      showToast(err(e, "送信を削除できませんでした"), "error");
    }
  }, [mutation, ids, removeItems, showToast]);

  return {
    /** 選んでいる回の id(読み込み済みで削除していない物) */
    ids,
    count: ids.length,
    isSelected: (id: string) => selected.has(id),
    selectable,
    toggle,
    selectAllLoaded,
    clear,
    /** 100 件を超えて選んでいる(削除のボタンを押せない) */
    overLimit: ids.length > DISPATCH_DELETE_MAX,
    confirmOpen,
    setConfirmOpen,
    summary,
    summaryError,
    summaryLoading,
    remove,
  };
}
