"use client";

// src/features/core/userGroup/hooks/useUserGroupRowActions.ts
//
// 管理: ユーザーグループの一覧の行の操作(D92)。アーカイブする・アクティブに戻す・削除。
// 部品 UserGroupRow の ConfirmPopover の onConfirm に渡す(Promise の間 loading)。結果は知らせ、一覧へ返す
// (アーカイブ・戻す = onChanged(返った 1 件) / 削除 = onDeleted(id))。失敗(使われているグループの削除の 409 など)は理由を知らせる

import { useCallback } from "react";

import { useDomainMutation } from "@/lib/crud";
import { err } from "@/lib/errors";
import { useToast } from "@/lib/toast";

import {
  archiveUserGroup,
  deleteUserGroup,
  restoreUserGroup,
  type AdminUserGroupDeleted,
  type AdminUserGroupDetail,
} from "../services/client/userGroupAdminClient";

import type { UserGroupAction } from "./useAdminUserGroupList";
import { USER_GROUPS_KEY } from "./userGroupKeys";

export type UseUserGroupRowActionsOptions = {
  onChanged: (group: AdminUserGroupDetail, action: UserGroupAction) => void;
  onDeleted: (id: string) => void;
};

export function useUserGroupRowActions({ onChanged, onDeleted }: UseUserGroupRowActionsOptions) {
  const { showToast } = useToast();
  const archiveMutation = useDomainMutation<AdminUserGroupDetail, string>(`${USER_GROUPS_KEY}/row/archive`, (id) => archiveUserGroup(id), [USER_GROUPS_KEY]);
  const restoreMutation = useDomainMutation<AdminUserGroupDetail, string>(`${USER_GROUPS_KEY}/row/restore`, (id) => restoreUserGroup(id), [USER_GROUPS_KEY]);
  const deleteMutation = useDomainMutation<AdminUserGroupDeleted, string>(`${USER_GROUPS_KEY}/row/delete`, (id) => deleteUserGroup(id), [USER_GROUPS_KEY]);

  const archive = useCallback(
    async (id: string) => {
      try {
        onChanged(await archiveMutation.trigger(id), "archive");
        showToast("アーカイブしました", "success");
      } catch (e) {
        showToast(err(e, "アーカイブできませんでした"), "error");
      }
    },
    [archiveMutation, onChanged, showToast],
  );

  const restore = useCallback(
    async (id: string) => {
      try {
        onChanged(await restoreMutation.trigger(id), "restore");
        showToast("使用中に戻しました", "success");
      } catch (e) {
        showToast(err(e, "使用中に戻せませんでした"), "error");
      }
    },
    [restoreMutation, onChanged, showToast],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.trigger(id);
        onDeleted(id);
        showToast("グループを削除しました", "success");
      } catch (e) {
        showToast(err(e, "グループを削除できませんでした"), "error");
      }
    },
    [deleteMutation, onDeleted, showToast],
  );

  return { archive, restore, remove };
}
