"use client";

// src/features/core/userGroup/hooks/useUserGroupModal.ts
//
// 管理: ユーザーグループを作る・直すモーダルの流れ(AdminUserGroupModal はこれと useUserGroupForm などを呼んで部品を並べるだけ)。
// - 開いている間だけ部品の一覧(catalog)と 1 件を取る
// - 作った後(動的・定期計算の保存 / 固定の 1 回目の送信)は、同じモーダルのままその 1 件を直す形に変わる(ページは移らない)
// - 固定の流れ(useUserGroupFreeze)はここが持つ: 書く欄を作り直しても送り直しが続く。進み具合は始めた開いた回だけに出す。「今の人で固定」(動的・定期計算の今の一員から
//   新しい固定のグループ、D51)もこれ。閉じたら送り直しを止める(閉じる前に確かめる)
// - 一員・例外の操作の後は 1 件を取り直し、一覧へ onChanged で渡す
// - formKey = 開いた回 + 1 件の id と更新(保存の後は書く欄をサーバーの値で作り直す)

import { useCallback, useEffect, useState } from "react";

import type { AdminUserGroupDetail } from "../services/client/userGroupAdminClient";

import type { UserGroupAction } from "./useAdminUserGroupList";
import { useModalSession } from "@/hooks/useModalSession";
import { useUserGroup, useUserGroupCriteriaCatalog } from "./useUserGroup";
import { useUserGroupFreeze } from "./useUserGroupFreeze";

/** モーダルのタブ */
export type UserGroupModalTab = "basic" | "condition" | "people";

export type UseUserGroupModalOptions = {
  open: boolean;
  /** 直す 1 件(null・省略 = 作る) */
  groupId?: string | null;
  /** 作る・保存・保管・一員・例外の後(一覧が行を足す・置き換える) */
  onChanged?: (group: AdminUserGroupDetail, action: UserGroupAction) => void;
};

export function useUserGroupModal({ open, groupId = null, onChanged }: UseUserGroupModalOptions) {
  const session = useModalSession(open);
  const [created, setCreated] = useState<{ session: number; id: string } | null>(null);
  const [tabState, setTabState] = useState<{ session: number; tab: UserGroupModalTab } | null>(null);
  const createdId = created && created.session === session ? created.id : null;
  const tab: UserGroupModalTab = tabState && tabState.session === session ? tabState.tab : "basic";
  const currentId = createdId ?? groupId;

  const { catalog, error: catalogError } = useUserGroupCriteriaCatalog(open);
  const { group, error: groupError, revalidate } = useUserGroup(open ? currentId : null);

  const setTab = useCallback((next: string) => setTabState({ session, tab: next as UserGroupModalTab }), [session]);
  const onCreated = useCallback((id: string) => setCreated({ session, id }), [session]);

  const rawFreeze = useUserGroupFreeze({
    onStarted: useCallback(
      (started: AdminUserGroupDetail) => {
        onCreated(started.id);
        onChanged?.(started, "create");
      },
      [onCreated, onChanged],
    ),
    onDone: useCallback(
      (done: AdminUserGroupDetail) => {
        void revalidate();
        onChanged?.(done, "members");
      },
      [revalidate, onChanged],
    ),
  });
  // 固定の進み具合は始めた開いた回の物(閉じて開き直した「新しく作る」に前の回の「書きました」を出さない)
  const [freezeSession, setFreezeSession] = useState<number | null>(null);
  const { start: startFreeze, cancel: cancelFreeze } = rawFreeze;
  const ownFreeze = freezeSession === session;
  const start = useCallback(
    (input: Parameters<typeof startFreeze>[0]) => {
      setFreezeSession(session);
      return startFreeze(input);
    },
    [session, startFreeze],
  );
  const freeze = {
    ...rawFreeze,
    start,
    progress: ownFreeze ? rawFreeze.progress : ({ status: "idle" } as const),
    running: ownFreeze && rawFreeze.running,
  };
  // 閉じたら送り直しを止める(閉じる前の確かめは closeConfirm)
  useEffect(() => {
    if (!open) cancelFreeze();
  }, [open, cancelFreeze]);

  /** 一員・例外の操作の後: 返った 1 件(無ければ取り直した 1 件)を一覧へ */
  const refresh = useCallback(
    async (fresh: AdminUserGroupDetail | null, action: UserGroupAction) => {
      const next = fresh ?? (await revalidate()) ?? null;
      if (fresh) void revalidate();
      if (next) onChanged?.(next, action);
    },
    [revalidate, onChanged],
  );

  /** 今の人で固定(動的・定期計算の今の一員から新しい固定のグループ) */
  const freezeCurrent = useCallback(
    (name: string) => {
      if (!group) return Promise.resolve(null);
      return start({ name, description: null, from: { type: "group", groupId: group.id } });
    },
    [group, start],
  );

  const state: "loading" | "error" | "ready" = catalogError
    ? "error"
    : !catalog
      ? "loading"
      : currentId && !group
        ? groupError
          ? "error"
          : "loading"
        : "ready";

  return {
    state,
    error: catalogError ?? groupError ?? null,
    mode: currentId ? ("edit" as const) : ("create" as const),
    catalog,
    group: currentId ? group : null,
    tab,
    setTab,
    onCreated,
    onChanged,
    refresh,
    freeze,
    freezeCurrent,
    /** 固定の途中で閉じる時の確かめ */
    freezeCloseConfirm: { enabled: freeze.running, message: "固定のグループの一員を書いている途中です。閉じると途中で止まります。閉じてもよろしいですか？" },
    formKey: group && currentId ? `${session}:${group.id}:${group.updatedAt}:${group.status}` : `${session}:new`,
  };
}

export type UserGroupModalState = ReturnType<typeof useUserGroupModal>;
