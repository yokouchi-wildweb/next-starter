// src/features/chatRoom/hooks/firestore/useMergedMessages.ts
//
// 実メッセージと pending メッセージを統合する Hook。
// useChatMessages + useChatMessageSender を組み合わせて
// 楽観的UI 付きの統一メッセージ一覧を提供する。
// 手動実装。

"use client";

import { useEffect, useMemo } from "react";

import type { ChatMessage } from "@/features/chatRoom/entities/message";
import type { PendingMessage } from "@/features/chatRoom/stores/messageSending";
import { useMessageSendingStore } from "@/features/chatRoom/stores/messageSending";

/** 表示用メッセージ。実メッセージまたは pending メッセージ。 */
export type DisplayMessage = {
  /** メッセージデータ */
  message: ChatMessage;
  /** pending メッセージの場合の送信状態（実メッセージの場合は undefined） */
  sendingStatus?: PendingMessage["status"];
  /** アップロード進捗（ファイル送信の uploading 時のみ） */
  uploadProgress?: PendingMessage["uploadProgress"];
  /** pending メッセージかどうか */
  isPending: boolean;
};

export type UseMergedMessagesReturn = {
  /** 時系列順の統合メッセージ一覧（実 + pending） */
  displayMessages: DisplayMessage[];
};

/**
 * 実メッセージと pending メッセージを統合する。
 *
 * - 実メッセージ到着時に対応する pending（status: "sent"）を自動除去
 * - pending メッセージは実メッセージの末尾に追加（時系列順）
 * - "failed" の pending は除去せず残す（再送/破棄はユーザー操作で）
 */
export function useMergedMessages(
  roomId: string | null,
  messages: ChatMessage[],
): UseMergedMessagesReturn {
  const { pendingMessages, removePending } = useMessageSendingStore(roomId);

  // 実メッセージ到着時に対応する pending を除去
  useEffect(() => {
    if (pendingMessages.length === 0 || messages.length === 0) return;

    const realIds = new Set(messages.map((m) => m.id));
    for (const pending of pendingMessages) {
      if (pending.status === "sent" && realIds.has(pending.message.id)) {
        removePending(pending.message.id);
      }
    }
  }, [messages, pendingMessages, removePending]);

  const displayMessages = useMemo(() => {
    const realIds = new Set(messages.map((m) => m.id));

    // 実メッセージを DisplayMessage に変換
    const realDisplay: DisplayMessage[] = messages.map((m) => ({
      message: m,
      isPending: false,
    }));

    // 実メッセージと重複しない pending を末尾に追加
    const pendingDisplay: DisplayMessage[] = pendingMessages
      .filter((p) => !realIds.has(p.message.id))
      .map((p) => ({
        message: p.message,
        sendingStatus: p.status,
        uploadProgress: p.uploadProgress,
        isPending: true,
      }));

    return [...realDisplay, ...pendingDisplay];
  }, [messages, pendingMessages]);

  return { displayMessages };
}
