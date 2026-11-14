"use client";

// src/features/core/userGroup/hooks/useAdminUserGroupList.ts
//
// 管理: ユーザーグループの一覧の流れ(AdminUserGroupList はこれを呼んで部品を並べるだけ。CLAUDE.md core_ui)。
// - 種類で絞る(空 = すべて)・状態(既定 使用中。保管したものは「保管」を選んだ時だけ)+ 無限スクロール(useUserGroups、カーソル)
// - 作る・直すモーダル(AdminUserGroupModal)の開き先: openNew = 作る、openGroup(id) = その 1 件を直す。閉じても開き先は残す
// - モーダルの操作の後(onChanged): 作った = 先頭から取り直す / 保管・状態が絞りから外れた = 行を外す / ほか = 返った 1 件で行を置き換える。
//   無限スクロールの一覧には SWR のキーの再検証が届かないため

import { useCallback, useState } from "react";

import type { AdminUserGroupDetail, AdminUserGroupSummary } from "../services/client/userGroupAdminClient";

import { useUserGroups } from "./useUserGroups";

/** モーダルの操作 */
export type UserGroupAction = "create" | "update" | "archive" | "members" | "exceptions";

/** 1 件の詳しい形から一覧の行の形へ */
export function userGroupSummaryOf(group: AdminUserGroupDetail): AdminUserGroupSummary {
  const { id, name, description, kind, kindLabel, status, statusLabel, count, recompute, createdAt, updatedAt } = group;
  return { id, name, description, kind, kindLabel, status, statusLabel, count, recompute, createdAt, updatedAt };
}

export type UseAdminUserGroupListOptions = {
  observerOptions?: IntersectionObserverInit;
};

export function useAdminUserGroupList(options: UseAdminUserGroupListOptions = {}) {
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const query = useUserGroups({ kind: kind || undefined, status, observerOptions: options.observerOptions });
  const [modalOpen, setModalOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setGroupId(null);
    setModalOpen(true);
  }, []);
  const openGroup = useCallback((id: string) => {
    setGroupId(id);
    setModalOpen(true);
  }, []);

  const { revalidate, updateItems, removeItems } = query;
  const onChanged = useCallback(
    (group: AdminUserGroupDetail, action: UserGroupAction) => {
      if (action === "create") return revalidate();
      if (group.status !== status || (kind && group.kind !== kind)) return removeItems((item) => item.id === group.id);
      updateItems(
        (item) => item.id === group.id,
        () => userGroupSummaryOf(group),
      );
    },
    [kind, status, revalidate, updateItems, removeItems],
  );

  return {
    kind,
    setKind,
    status,
    setStatus: (next: string) => setStatus(next === "archived" ? "archived" : "active"),
    query,
    modal: {
      open: modalOpen,
      setOpen: setModalOpen,
      /** 直す 1 件(null = 作る) */
      groupId,
      openNew,
      openGroup,
      /** モーダルの操作の後(AdminUserGroupModal の onChanged に渡す) */
      onChanged,
    },
  };
}
