// src/features/chatRoom/hooks/firestore/useChatMessageSender.ts
//
// メッセージ送信の統合 Hook。
// Store（送信状態管理）+ ClientService（実送信）+ clientUploader（アップロード）を
// 一つのインターフェースで提供する。
// 手動実装。

"use client";

import { useCallback, useRef } from "react";

import type { UploadTaskHandle } from "@/lib/storage/client/clientUploader";
import { clientUploader } from "@/lib/storage/client/clientUploader";
import { directStorageClient } from "@/lib/storage/client/directStorageClient";

import type { MessageMetadata, MessageType } from "@/features/chatRoom/entities/message";
import {
  generateMessageId,
  sendFileMessage,
  sendTextMessage,
} from "@/features/chatRoom/services/client/messageClient";
import { useMessageSendingStore } from "@/features/chatRoom/stores/messageSending";
import type { PendingMessage } from "@/features/chatRoom/stores/messageSending";
import { validateChatFile, validateTextMessage } from "@/features/chatRoom/utils/validation";
import type { ValidationResult } from "@/features/chatRoom/utils/validation";

export type UseChatMessageSenderReturn = {
  /** 指定ルームの pending メッセージ一覧 */
  pendingMessages: PendingMessage[];
  /**
   * テキストメッセージを送信する。
   * バリデーション失敗時は ValidationResult を返す。
   */
  sendText: (content: string) => Promise<ValidationResult>;
  /**
   * ファイル/画像メッセージを送信する。
   * アップロード → メッセージ作成を一貫して行う。
   * ファイル選択直後に pending メッセージが一覧に表示される（楽観的UI）。
   * バリデーション失敗時は ValidationResult を返す。
   */
  sendFile: (file: File, type: Extract<MessageType, "image" | "file">) => ValidationResult;
  /** 失敗したメッセージを再送する */
  retry: (pendingId: string) => Promise<void>;
  /** 失敗したメッセージを破棄する */
  dismiss: (pendingId: string) => void;
  /** 進行中のファイルアップロードをキャンセルする */
  cancelUpload: (pendingId: string) => void;
};

/**
 * メッセージ送信の統合 Hook。
 *
 * テキスト送信フロー:
 * 1. sendText → pending 追加（status: "sending"）→ 即座にUI表示
 * 2. writeBatch 成功 → "sent" → onSnapshot で実メッセージ到着 → pending 除去
 * 3. writeBatch 失敗 → "failed" → retry / dismiss
 *
 * ファイル送信フロー:
 * 1. sendFile → pending 追加（status: "uploading"）→ 即座にUI表示（進捗付き）
 * 2. アップロード完了 → "sending" → writeBatch 実行
 * 3. writeBatch 成功 → "sent" → onSnapshot で実メッセージ到着 → pending 除去
 * 4. アップロード/送信失敗 → "failed" → retry / dismiss
 */
export function useChatMessageSender(
  roomId: string | null,
  senderId: string | null,
): UseChatMessageSenderReturn {
  const {
    pendingMessages,
    addPending,
    updateStatus,
    updateProgress,
    removePending,
  } = useMessageSendingStore(roomId);

  // アクティブなアップロードタスク（キャンセル用）
  const uploadTasksRef = useRef<Map<string, UploadTaskHandle>>(new Map());
  // アップロード済みファイルパス（クリーンアップ用）
  const uploadedPathsRef = useRef<Map<string, string>>(new Map());

  /** アップロード済みファイルを Storage から削除する */
  const cleanupFile = useCallback((pendingId: string) => {
    const path = uploadedPathsRef.current.get(pendingId);
    if (path) {
      directStorageClient.remove(path).catch((err) => {
        console.error("[useChatMessageSender] cleanup error", err);
      });
      uploadedPathsRef.current.delete(pendingId);
    }
  }, []);

  /** ChatMessage の共通初期値を生成する */
  const buildBaseMessage = useCallback(
    (messageId: string, type: MessageType, content: string, metadata: MessageMetadata | null) => ({
      id: messageId,
      type,
      content,
      senderId: senderId!,
      metadata,
      createdAt: new Date(),
      editedAt: null,
      deletedAt: null,
    }),
    [senderId],
  );

  // -----------------------------------------------------------------------
  // テキスト送信
  // -----------------------------------------------------------------------

  const sendText = useCallback(
    async (content: string): Promise<ValidationResult> => {
      if (!roomId || !senderId) return { valid: false, reason: "送信できません。" };

      const validation = validateTextMessage(content);
      if (!validation.valid) return validation;

      const messageId = generateMessageId(roomId);
      const pending: PendingMessage = {
        message: buildBaseMessage(messageId, "text", content, null),
        status: "sending",
      };

      addPending(pending);

      try {
        await sendTextMessage({ roomId, content, senderId, messageId });
        updateStatus(messageId, "sent");

      } catch {
        updateStatus(messageId, "failed");
      }

      return { valid: true };
    },
    [roomId, senderId, addPending, updateStatus, buildBaseMessage],
  );

  // -----------------------------------------------------------------------
  // ファイル送信（アップロード → メッセージ作成を一貫実行）
  // -----------------------------------------------------------------------

  const sendFile = useCallback(
    (file: File, type: Extract<MessageType, "image" | "file">): ValidationResult => {
      if (!roomId || !senderId) return { valid: false, reason: "送信できません。" };

      const validation = validateChatFile(file, type);
      if (!validation.valid) return validation;

      const messageId = generateMessageId(roomId);
      const metadata: MessageMetadata = {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || undefined,
      };

      const pending: PendingMessage = {
        message: buildBaseMessage(messageId, type, "", metadata),
        status: "uploading",
        uploadProgress: null,
        file,
      };

      addPending(pending);

      const basePath = `chat/${roomId}`;
      const task = clientUploader.upload(file, {
        basePath,
        onProgress: (progress) => {
          updateProgress(messageId, progress);
        },
        onComplete: async (result) => {
          uploadTasksRef.current.delete(messageId);
          uploadedPathsRef.current.set(messageId, result.path);

          updateStatus(messageId, "sending");

          try {
            await sendFileMessage({
              roomId: roomId!,
              content: result.url,
              type,
              senderId: senderId!,
              metadata,
              messageId,
            });
            updateStatus(messageId, "sent");
            uploadedPathsRef.current.delete(messageId);
          } catch {
            updateStatus(messageId, "failed");
          }
        },
        onError: (err) => {
          uploadTasksRef.current.delete(messageId);
          if ("code" in err && (err as any).code === "storage/canceled") {
            return;
          }
          updateStatus(messageId, "failed");
        },
      });

      uploadTasksRef.current.set(messageId, task);

      return { valid: true };
    },
    [roomId, senderId, addPending, updateStatus, updateProgress, buildBaseMessage],
  );

  // -----------------------------------------------------------------------
  // 再送
  // -----------------------------------------------------------------------

  const retry = useCallback(
    async (pendingId: string) => {
      if (!roomId || !senderId) return;

      const pending = pendingMessages.find((m) => m.message.id === pendingId);
      if (!pending || pending.status !== "failed") return;

      const { message } = pending;

      if (message.type === "text" || message.type === "system") {
        updateStatus(pendingId, "sending");
        try {
          await sendTextMessage({
            roomId,
            content: message.content,
            senderId,
            messageId: pendingId,
          });
          updateStatus(pendingId, "sent");
  
        } catch {
          updateStatus(pendingId, "failed");
        }
      } else if (pending.file) {
        // ファイル再送（再アップロードから）
        removePending(pendingId);
        sendFile(pending.file, message.type as Extract<MessageType, "image" | "file">);
      } else if (message.content) {
        // アップロード済み・メッセージ送信のみ失敗した場合
        updateStatus(pendingId, "sending");
        try {
          await sendFileMessage({
            roomId,
            content: message.content,
            type: message.type as Extract<MessageType, "image" | "file">,
            senderId,
            metadata: message.metadata!,
            messageId: pendingId,
          });
          updateStatus(pendingId, "sent");
  
          uploadedPathsRef.current.delete(pendingId);
        } catch {
          updateStatus(pendingId, "failed");
        }
      }
    },
    [roomId, senderId, pendingMessages, updateStatus, removePending, sendFile],
  );

  // -----------------------------------------------------------------------
  // 破棄 / キャンセル
  // -----------------------------------------------------------------------

  const dismiss = useCallback(
    (pendingId: string) => {
      cleanupFile(pendingId);
      removePending(pendingId);
    },
    [cleanupFile, removePending],
  );

  const cancelUpload = useCallback(
    (pendingId: string) => {
      const task = uploadTasksRef.current.get(pendingId);
      if (task) {
        task.cancel();
        uploadTasksRef.current.delete(pendingId);
      }
      cleanupFile(pendingId);
      removePending(pendingId);
    },
    [cleanupFile, removePending],
  );

  return { pendingMessages, sendText, sendFile, retry, dismiss, cancelUpload };
}
