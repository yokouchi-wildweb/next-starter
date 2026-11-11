// src/features/core/user/hooks/useGeneralUserListTable.ts
// 管理画面の一般ユーザー一覧の処理(見た目は持たない):
// ポイント操作・管理・削除の対象の state、削除の実行(トースト + 再読み込み)、機能の開閉(wallet の gate と設定)、
// 選択テーブルの設定、一括操作の項目、変更の後の再読み込み。
// core の GeneralUserList/Table と、fork が _components に置く自前の Table が同じくこれを呼ぶ(README「管理画面の一般ユーザー一覧」)

"use client";

import { useCallback, useMemo, useState } from "react";

import { useRouter } from "@/lib/unsavedGuard";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { useGate } from "@/featureGate/client";
import type { User } from "@/features/core/user/entities";
import type { UserAdminBulkActionItem } from "@/features/core/user/types";
import { userConfig } from "@/features/user/config";
import { walletConfig } from "@/features/wallet/config";

import { useSoftDeleteUser } from "@/features/core/user/hooks/useSoftDeleteUser";
import { useUserAdminBulkActions } from "@/features/core/user/hooks/useUserAdminBulkActions";

export type UseGeneralUserListTableOptions = {
  /** 変更(ポイント操作・一括操作・削除)の後、router.refresh() に続けて呼ぶ */
  onChanged?: () => void;
};

type SelectionBehavior = (typeof userConfig.userListPage)["selectionBehavior"];

/** createGeneralUserListColumns に広げて渡す値(editBasePath だけは呼ぶ側が足す) */
export type GeneralUserListColumnHandlers = {
  canAdjustWallet: boolean;
  canManage: boolean;
  canMemo: boolean;
  isDeleting: boolean;
  onAdjust: (user: User) => void;
  onManage: (user: User) => void;
  onDelete: (user: User) => void;
};

export type UseGeneralUserListTableReturn = {
  /** ポイント操作を出すか(gate wallet が開いていて walletConfig.enableAdminBalanceAdjust) */
  canAdjustWallet: boolean;
  /** 管理モーダルを使うか(userConfig.enableUserManagement)。false = 削除の確認ダイアログ */
  canManage: boolean;
  /** メモの列を出すか(userConfig.enableUserMemo) */
  canMemo: boolean;
  /** 選択テーブル(userConfig.userListPage) */
  selection: {
    enabled: boolean;
    behavior: SelectionBehavior;
    bulkActionsAlwaysVisible: boolean;
  };
  /** 一括操作の項目(受け口 adminBulkActions の "general") */
  bulkActions: UserAdminBulkActionItem[];
  /** BulkActionItems の onDone に渡す(= refresh) */
  onBulkDone: () => void;
  adjust: {
    target: User | null;
    open: (user: User) => void;
    close: () => void;
    /** AdminWalletAdjustModal の onSuccess に渡す(= refresh) */
    onAdjusted: () => void;
  };
  manage: {
    target: User | null;
    open: (user: User) => void;
    close: () => void;
  };
  remove: {
    target: User | null;
    /** 確認ダイアログを開く */
    request: (user: User) => void;
    cancel: () => void;
    /** 削除を実行する(成功: トースト・閉じる・refresh / 失敗: エラートースト、開いたまま) */
    confirm: () => Promise<void>;
    isDeleting: boolean;
  };
  /** router.refresh() → onChanged?.() */
  refresh: () => void;
  /** createGeneralUserListColumns({ ...columnOptions, editBasePath }) で列を組む */
  columnOptions: GeneralUserListColumnHandlers;
};

export function useGeneralUserListTable({ onChanged }: UseGeneralUserListTableOptions = {}): UseGeneralUserListTableReturn {
  const [adjustTarget, setAdjustTarget] = useState<User | null>(null);
  const [manageTarget, setManageTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger: triggerDelete, isMutating: isDeleting } = useSoftDeleteUser();

  const canAdjustWallet = useGate().enabled("wallet") && walletConfig.enableAdminBalanceAdjust;
  const canManage = userConfig.enableUserManagement;
  const canMemo = userConfig.enableUserMemo;
  const { enableSelectionTable, selectionBehavior, bulkActionsAlwaysVisible } = userConfig.userListPage;
  // 一括操作: 受け口 adminBulkActions の項目(上流の既定 + fork の項目)
  const bulkActions = useUserAdminBulkActions("general");

  const refresh = useCallback(() => {
    router.refresh();
    onChanged?.();
  }, [router, onChanged]);

  const openAdjust = useCallback((user: User) => setAdjustTarget(user), []);
  const closeAdjust = useCallback(() => setAdjustTarget(null), []);
  const openManage = useCallback((user: User) => setManageTarget(user), []);
  const closeManage = useCallback(() => setManageTarget(null), []);
  const requestDelete = useCallback((user: User) => setDeleteTarget(user), []);
  const cancelDelete = useCallback(() => setDeleteTarget(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await triggerDelete({ userId: deleteTarget.id });
      showToast("ユーザーを削除しました", "success");
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      showToast(err(error, "ユーザーの削除に失敗しました"), "error");
    }
  }, [deleteTarget, triggerDelete, showToast, refresh]);

  const columnOptions = useMemo<GeneralUserListColumnHandlers>(
    () => ({
      canAdjustWallet,
      canManage,
      canMemo,
      isDeleting,
      onAdjust: openAdjust,
      onManage: openManage,
      onDelete: requestDelete,
    }),
    [canAdjustWallet, canManage, canMemo, isDeleting, openAdjust, openManage, requestDelete],
  );

  return {
    canAdjustWallet,
    canManage,
    canMemo,
    selection: {
      enabled: enableSelectionTable.general,
      behavior: selectionBehavior,
      bulkActionsAlwaysVisible,
    },
    bulkActions,
    onBulkDone: refresh,
    adjust: { target: adjustTarget, open: openAdjust, close: closeAdjust, onAdjusted: refresh },
    manage: { target: manageTarget, open: openManage, close: closeManage },
    remove: { target: deleteTarget, request: requestDelete, cancel: cancelDelete, confirm: confirmDelete, isDeleting },
    refresh,
    columnOptions,
  };
}
