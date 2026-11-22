"use client";

// src/domains/core/userGroup/hooks/useUserGroupStaticMembers.ts
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

/** 全員を外す時の送り直しの上限 */
const CLEAR_MAX_ATTEMPTS = 20;

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
  // 全員を外す(D94)。サーバーは予算つきで書くので incomplete の間は同じ body で送り直す(20 回まで)
  const clearPeople = useCallback(async () => {
    if (!groupId) return;
    for (let attempt = 0; attempt < CLEAR_MAX_ATTEMPTS; attempt += 1) {
      const result = await updateStaticMembers(groupId, { mode: "clear" });
      const done = !("members" in result) || result.members.status !== "incomplete";
      if (done) {
        onChanged?.("group" in result ? result.group : null);
        return;
      }
    }
    throw new Error("全員を削除しきれませんでした。もう一度お試しください");
  }, [groupId, onChanged]);
  return useUserGroupPeople({
    fetchPage: groupId ? (cursor, limit, q) => listStaticMembers(groupId, { cursor, limit, q }) : null,
    deps: [groupId],
    enabled,
    addPeople,
    removePeople,
    clearPeople,
    addedMessage: "メンバーを追加しました",
    removedMessage: "メンバーから削除しました",
    observerOptions,
  });
}
