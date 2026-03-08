// src/features/chatRoom/hooks/firestore/useChatMessageSender.ts
//
// メッセージ送信の統合 Hook。
// Store（送信状態管理）+ ClientService（実送信）を組み合わせ、
// 楽観的UI・再送・破棄を一つのインターフェースで提供する。
// 手動実装。

"use client";

import { useCallback } from "react";

import type { UploadProgress } from "@/lib/storage/client/clientUploader";

import type { MessageMetadata, MessageType } from "@/features/chatRoom/entities/message";
import {
  generateMessageId,
  sendFileMessage,
  sendTextMessage,
} from "@/features/chatRoom/services/client/messageClient";
import { useMessageSendingStore } from "@/features/chatRoom/stores/messageSending";
import type { PendingMessage } from "@/features/chatRoom/stores/messageSending";

export type UseChatMessageSenderReturn = {
  /** 指定ルームの pending メッセージ一覧 */
  pendingMessages: PendingMessage[];
  /** テキストメッセージを送信する */
  sendText: (content: string) => Promise<void>;
  /**
   * ファイルメッセージを送信する（アップロード完了後に呼ぶ）。
   * ファイルアップロード自体は useSendChatFile を使用する。
   */
  sendFile: (params: {
    content: string;
    type: Extract<MessageType, "image" | "file">;
    metadata: MessageMetadata;
    file?: File;
  }) => Promise<void>;
  /** 失敗したメッセージを再送する */
  retry: (pendingId: string) => Promise<void>;
  /** 失敗したメッセージを破棄する */
  dismiss: (pendingId: string) => void;
};

/**
 * メッセージ送信の統合 Hook。
 *
 * 楽観的UI フロー:
 * 1. 送信呼び出し → pending メッセージ追加（status: "sending"、即座にUI表示）
 * 2. writeBatch 成功 → status: "sent"
 * 3. onSnapshot で実メッセージ到着 → pending から除去（useChatMessages 側で処理）
 * 4. writeBatch 失敗 → status: "failed"、再送/破棄ボタン表示
 */
export function useChatMessageSender(
  roomId: string | null,
  senderId: string | null,
): UseChatMessageSenderReturn {
  const {
    pendingMessages,
    addPending,
    updateStatus,
    removePending,
  } = useMessageSendingStore(roomId);

  const sendText = useCallback(
    async (content: string) => {
      if (!roomId || !senderId) return;

      const messageId = generateMessageId(roomId);
      const pending: PendingMessage = {
        id: messageId,
        roomId,
        type: "text",
        content,
        senderId,
        metadata: null,
        status: "sending",
        createdAt: new Date(),
      };

      addPending(pending);

      try {
        await sendTextMessage({ roomId, content, senderId, messageId });
        updateStatus(messageId, "sent");
      } catch {
        updateStatus(messageId, "failed");
      }
    },
    [roomId, senderId, addPending, updateStatus],
  );

  const sendFile = useCallback(
    async (params: {
      content: string;
      type: Extract<MessageType, "image" | "file">;
      metadata: MessageMetadata;
      file?: File;
    }) => {
      if (!roomId || !senderId) return;

      const messageId = generateMessageId(roomId);
      const pending: PendingMessage = {
        id: messageId,
        roomId,
        type: params.type,
        content: params.content,
        senderId,
        metadata: params.metadata,
        status: "sending",
        createdAt: new Date(),
        file: params.file,
      };

      addPending(pending);

      try {
        await sendFileMessage({
          roomId,
          content: params.content,
          type: params.type,
          senderId,
          metadata: params.metadata,
          messageId,
        });
        updateStatus(messageId, "sent");
      } catch {
        updateStatus(messageId, "failed");
      }
    },
    [roomId, senderId, addPending, updateStatus],
  );

  const retry = useCallback(
    async (pendingId: string) => {
      if (!roomId || !senderId) return;

      const pending = pendingMessages.find((m) => m.id === pendingId);
      if (!pending || pending.status !== "failed") return;

      updateStatus(pendingId, "sending");

      try {
        if (pending.type === "text") {
          await sendTextMessage({
            roomId,
            content: pending.content,
            senderId,
            messageId: pendingId,
          });
        } else {
          await sendFileMessage({
            roomId,
            content: pending.content,
            type: pending.type as Extract<MessageType, "image" | "file">,
            senderId,
            metadata: pending.metadata!,
            messageId: pendingId,
          });
        }
        updateStatus(pendingId, "sent");
      } catch {
        updateStatus(pendingId, "failed");
      }
    },
    [roomId, senderId, pendingMessages, updateStatus],
  );

  const dismiss = useCallback(
    (pendingId: string) => {
      removePending(pendingId);
    },
    [removePending],
  );

  return { pendingMessages, sendText, sendFile, retry, dismiss };
}
