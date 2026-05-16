// src/features/core/notification/hooks/useNotificationViewModal.ts
// 通知の詳細モーダル用にデータを集約するフック。
// JSX は含めず、表示用の素材データだけを返す（描画は呼び出し元コンポーネントの責務）。

"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { userClient } from "@/features/core/user/services/client/userClient";
import type { User } from "@/features/core/user/entities";
import type { HttpError } from "@/lib/errors";
import type { PaginatedResult } from "@/lib/crud/types";

import { useNotification } from "./useNotification";

/** 詳細モーダルで表示する対象ユーザーの最大件数 */
export const NOTIFICATION_TARGET_USERS_DISPLAY_LIMIT = 100;

export type NotificationTargetUserDisplay = {
  id: string;
  name: string | null;
  email: string | null;
  /** users テーブルで見つからなかった場合 false */
  found: boolean;
};

export type NotificationViewModalData = {
  /** 表示対象ユーザーリスト（target_type が "individual" のときのみ意味を持つ） */
  targetUsers: NotificationTargetUserDisplay[];
  /** 全 target_user_ids 件数（DISPLAY_LIMIT を超えた件数表示用） */
  totalTargetUserIdCount: number;
};

export const useNotificationViewModal = (notificationId: string | null) => {
  const { data: notification, isLoading } = useNotification(notificationId);

  const targetUserIds = useMemo<string[]>(() => {
    if (!notification || notification.target_type !== "individual") return [];
    const ids = notification.target_user_ids ?? [];
    return ids.slice(0, NOTIFICATION_TARGET_USERS_DISPLAY_LIMIT);
  }, [notification]);

  const swrKey =
    targetUserIds.length > 0 && notification
      ? `notification:${notification.id}:targetUsers:${targetUserIds.join(",")}`
      : null;

  const { data: targetUsersData, isLoading: isLoadingTargets } = useSWR<
    PaginatedResult<User>,
    HttpError
  >(swrKey, () => {
    const search = userClient.search;
    if (!search) throw new Error("Userの検索機能が利用できません");
    return search({
      where: { field: "id", op: "in", value: targetUserIds },
      limit: targetUserIds.length,
    });
  });

  const targetUsers = useMemo<NotificationTargetUserDisplay[]>(() => {
    if (targetUserIds.length === 0) return [];
    const userMap = new Map((targetUsersData?.results ?? []).map((u) => [u.id, u]));
    return targetUserIds.map((id) => {
      const u = userMap.get(id);
      return {
        id,
        name: u?.name ?? null,
        email: u?.email ?? null,
        found: !!u,
      };
    });
  }, [targetUserIds, targetUsersData]);

  const data = useMemo<NotificationViewModalData>(() => {
    const totalTargetUserIdCount =
      notification?.target_type === "individual"
        ? notification.target_user_ids?.length ?? 0
        : 0;
    return {
      targetUsers,
      totalTargetUserIdCount,
    };
  }, [notification, targetUsers]);

  return {
    isLoading: isLoading || isLoadingTargets,
    notification: notification ?? null,
    data,
  };
};
