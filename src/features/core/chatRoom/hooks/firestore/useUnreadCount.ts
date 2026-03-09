// src/features/chatRoom/hooks/firestore/useUnreadCount.ts
//
// 未読ルーム数のリアルタイム取得 Hook。
// ヘッダーやボトムナビのバッジ表示用。
// 手動実装。

"use client";

import { useMemo } from "react";

import { useChatRooms } from "@/features/chatRoom/hooks/firestore/useChatRooms";
import type { SubscribeRoomsOptions } from "@/features/chatRoom/services/client/firestoreClient";
import { countUnreadRooms } from "@/features/chatRoom/utils/unread";

/**
 * 未読ルーム数をリアルタイムで取得する。
 *
 * 内部で useChatRooms を購読し、未読ルーム数をカウントして返す。
 * options.type でルームタイプを絞り込める。
 *
 * @example
 * ```tsx
 * // ヘッダーのバッジ表示
 * const unreadCount = useUnreadCount(uid);
 *
 * // スカウトチャットのみ
 * const scoutUnread = useUnreadCount(uid, { type: "scout" as any });
 * ```
 */
export function useUnreadCount(
  uid: string | null,
  options?: SubscribeRoomsOptions,
): number {
  const { rooms } = useChatRooms(uid, options);

  return useMemo(() => {
    if (!uid) return 0;
    return countUnreadRooms(rooms, uid);
  }, [rooms, uid]);
}
