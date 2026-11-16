"use client";

// src/features/core/userGroup/hooks/useUserGroupStaticMembers.ts
//
// 管理: 静的グループの一員(表示名、カーソル)と、選んで足す・1 人ずつ外す。
// 口: GET /api/admin/user-groups/[id]/members(一覧)・POST [id]/members { mode: "add" | "remove", userIds }。
// 足す・外すの後は onChanged(グループの 1 件が返れば渡す。外すは人数だけ返るので無し = 入れ物が 1 件を取り直す)

import { useCallback } from "react";

import {
  listStaticMembers,
  updateStaticMembers,
  type AdminUserGroupDetail,
} from "../services/client/userGroupAdminClient";

import { useUserGroupPeople } from "./useUserGroupPeople";

export type UseUserGroupStaticMembersOptions = {
  groupId: string | null;
  enabled?: boolean;
  onChanged?: (group: AdminUserGroupDetail | null) => void;
  observerOptions?: IntersectionObserverInit;
};

export function useUserGroupStaticMembers({ groupId, enabled = true, onChanged, observerOptions }: UseUserGroupStaticMembersOptions) {
  const addPeople = useCallback(
    async (userIds: string[]) => {
      if (!groupId) return;
      const result = await updateStaticMembers(groupId, { mode: "add", userIds });
      onChanged?.("group" in result ? result.group : null);
    },
    [groupId, onChanged],
  );
  const removePeople = useCallback(
    async (userIds: string[]) => {
      if (!groupId) return;
      await updateStaticMembers(groupId, { mode: "remove", userIds });
      onChanged?.(null);
    },
    [groupId, onChanged],
  );
  return useUserGroupPeople({
    fetchPage: groupId ? (cursor, limit, q) => listStaticMembers(groupId, { cursor, limit, q }) : null,
    deps: [groupId],
    enabled,
    addPeople,
    removePeople,
    addedMessage: "メンバーを追加しました",
    removedMessage: "メンバーから削除しました",
    observerOptions,
  });
}
