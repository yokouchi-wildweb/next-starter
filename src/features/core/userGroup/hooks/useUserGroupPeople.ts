"use client";

// src/features/core/userGroup/hooks/useUserGroupPeople.ts
//
// 管理: 人の一覧と選んで足す・外すの共通の流れ(静的グループの一員・例外の人。useUserGroupStaticMembers / useUserGroupExceptions が使う)。
// - 一覧 = 表示名つきのカーソルの無限スクロール。足す人は利用者を選ぶ部品で選ぶ(picks)
// - add() = 選んだ人を足して picks を空に、一覧を先頭から取り直す / remove(id) = 1 人外して行を外す

import { useCallback, useState } from "react";

import { useInfiniteScrollQuery } from "@/hooks/useInfiniteScrollQuery";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import type { AdminUserGroupMember, AdminUserGroupMemberPage } from "../services/client/userGroupAdminClient";

const LIMIT = 50;

export type UseUserGroupPeopleOptions = {
  /** 1 ページを取る(null = まだ取れない) */
  fetchPage: ((cursor: string | null, limit: number) => Promise<AdminUserGroupMemberPage>) | null;
  /** 取り直しの鍵(グループ・側が変われば先頭から) */
  deps: ReadonlyArray<unknown>;
  enabled: boolean;
  addPeople: (userIds: string[]) => Promise<void>;
  removePerson: (userId: string) => Promise<void>;
  addedMessage: string;
  removedMessage: string;
  observerOptions?: IntersectionObserverInit;
};

export function useUserGroupPeople(options: UseUserGroupPeopleOptions) {
  const { fetchPage, deps, enabled, addPeople, removePerson, addedMessage, removedMessage, observerOptions } = options;
  const { showToast } = useToast();
  const query = useInfiniteScrollQuery<AdminUserGroupMember, Record<string, never>>({
    cursorFetcher: ({ cursor, limit }) => (fetchPage ? fetchPage(cursor, limit) : Promise.resolve({ items: [], nextCursor: null })),
    limit: LIMIT,
    enabled: enabled && fetchPage !== null,
    observerOptions,
    deps,
  });
  const [picks, setPicks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { revalidate, removeItems } = query;

  const add = useCallback(async () => {
    if (picks.length === 0) return;
    setBusy(true);
    try {
      await addPeople(picks);
      setPicks([]);
      revalidate();
      showToast(addedMessage, "success");
    } catch (error) {
      showToast(err(error, "足せませんでした"), "error");
    } finally {
      setBusy(false);
    }
  }, [picks, addPeople, revalidate, showToast, addedMessage]);

  const remove = useCallback(
    async (userId: string) => {
      setBusy(true);
      try {
        await removePerson(userId);
        removeItems((item) => item.id === userId);
        showToast(removedMessage, "success");
      } catch (error) {
        showToast(err(error, "外せませんでした"), "error");
      } finally {
        setBusy(false);
      }
    },
    [removePerson, removeItems, showToast, removedMessage],
  );

  return {
    query,
    picks,
    setPicks: (values: readonly (string | number | boolean)[]) => setPicks(values.map(String)),
    busy,
    add,
    remove,
  };
}

export type UserGroupPeopleState = ReturnType<typeof useUserGroupPeople>;
