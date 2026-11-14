"use client";

// src/features/core/userGroup/hooks/useUserGroup.ts
//
// 管理: ユーザーグループ 1 件と、条件の部品の一覧(SWR)。モーダルが開いている間だけ取る

import useSWR from "swr";

import {
  getUserGroup,
  getUserGroupCriteria,
  type AdminUserGroupCriteriaCatalog,
  type AdminUserGroupDetail,
} from "../services/client/userGroupAdminClient";

import { USER_GROUP_CRITERIA_KEY, userGroupKey } from "./userGroupKeys";

export function useUserGroup(id: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<AdminUserGroupDetail>(id ? userGroupKey(id) : null, () => getUserGroup(id!));
  return {
    group: data ?? null,
    error,
    isLoading,
    /** 取り直す(取り直した 1 件を返す) */
    revalidate: () => mutate(),
  };
}

/** 条件の部品の一覧と選択肢(画面は label を出し、key は定義の木の値としてだけ使う)。enabled = false の間は取らない */
export function useUserGroupCriteriaCatalog(enabled = true) {
  const { data, error, isLoading } = useSWR<AdminUserGroupCriteriaCatalog>(enabled ? USER_GROUP_CRITERIA_KEY : null, () =>
    getUserGroupCriteria(),
  );
  return { catalog: data ?? null, error, isLoading };
}
