"use client";

// src/features/core/userGroup/hooks/useUserGroupExceptions.ts
//
// 管理: 例外の人(動的・定期計算だけ)。include = 条件に合わなくても入れる人 / exclude = 条件に合っても外す人。
// 側ごとに一覧(表示名、カーソル)と、選んで足す・1 人ずつ外す。口: GET [id]/exceptions?side・PUT [id]/exceptions。
// 片方に足した人はサーバーがもう片方から外すので、足した後は両方の一覧を取り直す。操作の後は onChanged(返った 1 件)

import { useCallback, useEffect, useRef } from "react";

import {
  listUserGroupExceptions,
  updateUserGroupExceptions,
  type AdminUserGroupDetail,
  type UserGroupExceptionSide,
} from "../services/client/userGroupAdminClient";

import { useUserGroupPeople } from "./useUserGroupPeople";

export type UseUserGroupExceptionsOptions = {
  groupId: string | null;
  enabled?: boolean;
  onChanged?: (group: AdminUserGroupDetail) => void;
  observerOptions?: IntersectionObserverInit;
};

function useSide(side: UserGroupExceptionSide, options: UseUserGroupExceptionsOptions, afterAdd: () => void) {
  const { groupId, enabled = true, onChanged, observerOptions } = options;
  const addPeople = useCallback(
    async (userIds: string[]) => {
      if (!groupId) return;
      const fresh = await updateUserGroupExceptions(groupId, { [side]: { add: userIds } });
      onChanged?.(fresh);
      afterAdd();
    },
    [groupId, side, onChanged, afterAdd],
  );
  const removePerson = useCallback(
    async (userId: string) => {
      if (!groupId) return;
      const fresh = await updateUserGroupExceptions(groupId, { [side]: { remove: [userId] } });
      onChanged?.(fresh);
    },
    [groupId, side, onChanged],
  );
  return useUserGroupPeople({
    fetchPage: groupId ? (cursor, limit) => listUserGroupExceptions(groupId, { side, cursor, limit }) : null,
    deps: [groupId, side],
    enabled,
    addPeople,
    removePerson,
    addedMessage: side === "include" ? "入れる人に足しました" : "外す人に足しました",
    removedMessage: side === "include" ? "入れる人から外しました" : "外す人から外しました",
    observerOptions,
  });
}

export function useUserGroupExceptions(options: UseUserGroupExceptionsOptions) {
  // 片方に足すとサーバーがもう片方から外す → もう片方の一覧も取り直す(相手の revalidate は描いた後に箱へ入れる)
  const revalidators = useRef<{ include?: () => void; exclude?: () => void }>({});
  const include = useSide("include", options, useCallback(() => revalidators.current.exclude?.(), []));
  const exclude = useSide("exclude", options, useCallback(() => revalidators.current.include?.(), []));
  const revalidateInclude = include.query.revalidate;
  const revalidateExclude = exclude.query.revalidate;
  useEffect(() => {
    revalidators.current = { include: revalidateInclude, exclude: revalidateExclude };
  }, [revalidateInclude, revalidateExclude]);
  return { include, exclude };
}

export type UserGroupExceptionsState = ReturnType<typeof useUserGroupExceptions>;
