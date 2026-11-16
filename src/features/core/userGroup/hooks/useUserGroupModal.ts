"use client";

// src/features/core/userGroup/hooks/useUserGroupModal.ts
//
// 管理: ユーザーグループを作る・直すモーダルの流れ(AdminUserGroupModal はこれと useUserGroupForm などを呼んで部品を並べるだけ)。
// - 開いている間だけ部品の一覧(catalog)と 1 件を取る
// - 作った後(動的・定期計算の保存 / 固定の 1 回目の送信)は、同じモーダルのままその 1 件を直す形に変わる(ページは移らない)
// - 固定の流れ(useUserGroupFreeze)はここが持つ: 書く欄を作り直しても送り直しが続く。進み具合は始めた開いた回だけに出す。「今の人で固定」(動的・定期計算の今の一員から
//   新しい固定のグループ、D51)もこれ。閉じたら送り直しを止める(閉じる前に確かめる)
// - 一員・例外の操作の後は 1 件を取り直し、一覧へ onChanged で渡す
// - formKey = 開いた回 + 1 件の id と更新の印(保存の後は書く欄をサーバーの値で作り直す)。印は書く欄の操作(作る・保存・アーカイブ・戻す)
//   の後の updatedAt だけで、一員・例外の操作(refresh)の後の更新では変えない(書く欄を作り直さない、D94。数と要約はその場で新しくなる)

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

  // 書く欄の作り直しの印(D94)。1 件の updatedAt が変わった時、直前が一員・例外の操作なら印を変えない(描く間に決める、effect なし)
  const [stamp, setStamp] = useState<{ seen: string | null; value: string | null; peoplePending: boolean }>({
    seen: null,
    value: null,
    peoplePending: false,
  });
  const seenUpdatedAt = group && currentId ? group.updatedAt : null;
  if (seenUpdatedAt !== stamp.seen) {
    setStamp({
      seen: seenUpdatedAt,
      value: stamp.peoplePending && stamp.value !== null ? stamp.value : seenUpdatedAt,
      peoplePending: false,
    });
  }

  /** 書く欄の操作の後(作る・保存・アーカイブ・戻す): 次の更新で書く欄を作り直す */
  const onFormChanged = useCallback(
    (changed: AdminUserGroupDetail, action: UserGroupAction) => {
      setStamp((prev) => ({ ...prev, peoplePending: false }));
      onChanged?.(changed, action);
    },
    [onChanged],
  );

  /** 一員・例外の操作の後: 返った 1 件(無ければ取り直した 1 件)を一覧へ。書く欄は作り直さない */
  const refresh = useCallback(
    async (fresh: AdminUserGroupDetail | null, action: UserGroupAction) => {
      setStamp((prev) => ({ ...prev, peoplePending: true }));
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
    /** 書く欄の操作の後(useUserGroupForm の onChanged に渡す) */
    onChanged: onFormChanged,
    refresh,
    freeze,
    freezeCurrent,
    /** 固定の途中で閉じる時の確かめ */
    freezeCloseConfirm: { enabled: freeze.running, message: "固定グループのメンバーを登録しています。閉じると登録が中断されます。閉じてもよろしいですか？" },
    formKey: group && currentId ? `${session}:${group.id}:${stamp.value ?? group.updatedAt}:${group.status}` : `${session}:new`,
  };
}

export type UserGroupModalState = ReturnType<typeof useUserGroupModal>;
