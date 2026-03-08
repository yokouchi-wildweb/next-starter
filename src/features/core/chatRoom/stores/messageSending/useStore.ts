// src/features/chatRoom/stores/messageSending/useStore.ts
"use client";

import { useCallback, useMemo } from "react";

import { internalStore } from "./internalStore";
import type { MessageSendingStatus, PendingMessage } from "./types";

export type UseMessageSendingStoreReturn = {
  /** 指定ルームの pending メッセージ一覧 */
  pendingMessages: PendingMessage[];
  /** 送信中メッセージを追加する */
  addPending: (message: PendingMessage) => void;
  /** メッセージの送信状態を更新する */
  updateStatus: (id: string, status: MessageSendingStatus) => void;
  /** 送信中メッセージを除去する */
  removePending: (id: string) => void;
  /** 指定ルームの送信済みメッセージをすべて除去する */
  clearSent: () => void;
  /** 指定ルームの全 pending メッセージを除去する */
  clearRoom: () => void;
};

/**
 * メッセージ送信状態の管理 Store へのアクセス Hook。
 *
 * roomId を指定すると、そのルームの pending メッセージのみ返す。
 */
export function useMessageSendingStore(roomId: string | null): UseMessageSendingStoreReturn {
  const pendingByRoom = internalStore((s) => s.pendingByRoom);
  const addPending = internalStore((s) => s.addPending);
  const updateStatus = internalStore((s) => s.updateStatus);
  const removePending = internalStore((s) => s.removePending);
  const storeClearSent = internalStore((s) => s.clearSent);
  const storeClearRoom = internalStore((s) => s.clearRoom);

  const pendingMessages = useMemo(
    () => (roomId ? pendingByRoom[roomId] ?? [] : []),
    [pendingByRoom, roomId],
  );

  const clearSent = useCallback(() => {
    if (roomId) storeClearSent(roomId);
  }, [roomId, storeClearSent]);

  const clearRoom = useCallback(() => {
    if (roomId) storeClearRoom(roomId);
  }, [roomId, storeClearRoom]);

  return {
    pendingMessages,
    addPending,
    updateStatus,
    removePending,
    clearSent,
    clearRoom,
  };
}
