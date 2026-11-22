"use client";

// src/domains/core/userGroup/hooks/useUserGroupPeople.ts
//
// 管理: 人の一覧と選んで足す・外すの共通の流れ(静的グループの一員・例外の人。useUserGroupStaticMembers / useUserGroupExceptions が使う)。
// - タブの中は要約(D93): 1 ページ目の先頭 3 名(summary、名前の検索なし)。人数は呼び手が持つ(グループの数)
// - 一覧はサブのモーダル(listOpen の間だけ取る): 名前の検索 q(少し待ってから取り直す)+ カーソルの無限スクロール + 行ごとの選択
// - add() = 選んだ人を足して picks を空に、要約と一覧を取り直す
// - removeMany(ids) = まとめて外し、行を外して選択を空に、要約を取り直す(remove(id) = 1 人)
// - clearAll() = 全員を外す(検索に関係なく一覧の全部、D94)。足している間は読み込みの知らせ(useLoadingToast)

import { useCallback, useEffect, useState } from "react";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { err } from "@/lib/errors";
import { useLoadingToast, useToast } from "@/lib/toast";

import type { AdminUserGroupMember, AdminUserGroupMemberPage } from "../services/client/userGroupAdminClient";

const LIMIT = 50;
const SUMMARY_LIMIT = 3;
const SEARCH_DELAY_MS = 300;

export type UseUserGroupPeopleOptions = {
  /** 1 ページを取る(q = 名前の検索。null = まだ取れない) */
  fetchPage: ((cursor: string | null, limit: number, q?: string) => Promise<AdminUserGroupMemberPage>) | null;
  /** 取り直しの鍵(グループ・側が変われば先頭から) */
  deps: ReadonlyArray<unknown>;
  enabled: boolean;
  addPeople: (userIds: string[]) => Promise<void>;
  /** まとめて外す(API は id の並びを受ける) */
  removePeople: (userIds: string[]) => Promise<void>;
  /** 全員を外す(D94) */
  clearPeople: () => Promise<void>;
  addedMessage: string;
  removedMessage: string;
  observerOptions?: IntersectionObserverInit;
};

export function useUserGroupPeople(options: UseUserGroupPeopleOptions) {
  const { fetchPage, deps, enabled, addPeople, removePeople, clearPeople, addedMessage, removedMessage, observerOptions } = options;
  const { showToast } = useToast();
  const canFetch = enabled && fetchPage !== null;

  // タブの中の要約(先頭 3 名)
  const summary = useInfiniteScrollQuery<AdminUserGroupMember, Record<string, never>>({
    cursorFetcher: ({ cursor, limit }) => (fetchPage ? fetchPage(cursor, limit) : Promise.resolve({ items: [], nextCursor: null })),
    limit: SUMMARY_LIMIT,
    enabled: canFetch,
    deps: [...deps, "summary"],
  });

  // サブのモーダルの一覧(開いている間だけ、名前の検索つき)
  const [listOpen, setListOpenState] = useState(false);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [qInput]);
  const query = useInfiniteScrollQuery<AdminUserGroupMember, Record<string, never>>({
    cursorFetcher: ({ cursor, limit }) => (fetchPage ? fetchPage(cursor, limit, q || undefined) : Promise.resolve({ items: [], nextCursor: null })),
    limit: LIMIT,
    enabled: canFetch && listOpen,
    observerOptions,
    deps: [...deps, q],
  });

  const [picks, setPicks] = useState<string[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  useLoadingToast(adding, "追加しています…");
  const { revalidate, removeItems } = query;
  const revalidateSummary = summary.revalidate;

  const setListOpen = useCallback((open: boolean) => {
    setListOpenState(open);
    if (!open) {
      setSelected(new Set());
      setQInput("");
      setQ("");
    }
  }, []);

  const toggle = useCallback((id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const add = useCallback(async () => {
    if (picks.length === 0) return;
    setBusy(true);
    setAdding(true);
    try {
      await addPeople(picks);
      setPicks([]);
      revalidateSummary();
      if (listOpen) revalidate();
      showToast(addedMessage, "success");
    } catch (error) {
      showToast(err(error, "追加できませんでした"), "error");
    } finally {
      setAdding(false);
      setBusy(false);
    }
  }, [picks, addPeople, revalidateSummary, listOpen, revalidate, showToast, addedMessage]);

  const removeMany = useCallback(
    async (userIds: readonly string[]) => {
      if (userIds.length === 0) return;
      const ids = new Set(userIds);
      setBusy(true);
      try {
        await removePeople([...ids]);
        removeItems((item) => ids.has(item.id));
        setSelected(new Set());
        revalidateSummary();
        showToast(ids.size > 1 ? `${ids.size} 名を${removedMessage}` : removedMessage, "success");
      } catch (error) {
        showToast(err(error, "削除できませんでした"), "error");
      } finally {
        setBusy(false);
      }
    },
    [removePeople, removeItems, revalidateSummary, showToast, removedMessage],
  );

  const remove = useCallback((userId: string) => removeMany([userId]), [removeMany]);

  /** 全員を外す(検索に関係なく全部)。一覧は空にし、要約を取り直す */
  const clearAll = useCallback(async () => {
    setBusy(true);
    try {
      await clearPeople();
      removeItems(() => true);
      setSelected(new Set());
      revalidateSummary();
      showToast(`全員を${removedMessage}`, "success");
    } catch (error) {
      showToast(err(error, "削除できませんでした"), "error");
    } finally {
      setBusy(false);
    }
  }, [clearPeople, removeItems, revalidateSummary, showToast, removedMessage]);

  return {
    /** タブの中の要約(先頭 3 名) */
    summary,
    /** サブのモーダルの一覧 */
    query,
    listOpen,
    setListOpen,
    /** 名前の検索の入力(少し待ってから一覧を取り直す) */
    q: qInput,
    setQ: setQInput,
    /** 一覧で選んだ人 */
    selectedIds: [...selected],
    isSelected: (id: string) => selected.has(id),
    toggle,
    clearSelection: () => setSelected(new Set()),
    picks,
    setPicks: (values: readonly (string | number | boolean)[]) => setPicks(values.map(String)),
    busy,
    add,
    remove,
    removeMany,
    clearAll,
    /** 要約と(開いていれば)一覧を取り直す(よそで一員を変えた後、D101) */
    refresh: () => {
      revalidateSummary();
      if (listOpen) revalidate();
    },
    /** 名前の検索が入っている(全員を削除は検索を消してから) */
    searching: qInput.trim() !== "",
  };
}

export type UserGroupPeopleState = ReturnType<typeof useUserGroupPeople>;
