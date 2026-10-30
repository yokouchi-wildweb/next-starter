// src/features/chatRoom/hooks/firestore/useChatMessageSender.ts
//
// メッセージ送信の統合 Hook。
// Store（送信状態管理）+ ClientService（実送信）+ uploadToStorage（アップロード）を
// 一つのインターフェースで提供する。
// ファイルは種類ごとの用途 chatRoom.image / video / file に、scopeId = roomId で上げ、メッセージの content に ref を入れる
// （用途の read はルームの現参加者だけ。表示は resolveStorageSrc(content)。README「ファイル添付」）。
// 手動実装。

"use client";

import { useCallback, useRef } from "react";

import {
  isStorageUploadCanceled,
  storageClient,
  uploadToStorage,
  type UploadTaskHandle,
} from "@/lib/storage/client";

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

/** メッセージの種類 → ファイル用途（storageObject/purposes/chatRoom.ts） */
const CHAT_STORAGE_PURPOSES = {
  image: "chatRoom.image",
  video: "chatRoom.video",
  file: "chatRoom.file",
} as const satisfies Record<Extract<MessageType, "image" | "video" | "file">, string>;

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
  sendFile: (file: File, type: Extract<MessageType, "image" | "video" | "file">) => ValidationResult;
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
  // アップロード済み・メッセージ未送信のファイル（取り消し用。pendingId → objectId）
  const uploadedObjectsRef = useRef<Map<string, string>>(new Map());

  /** 送らなかったファイルを取り消す（本人の未採用分だけが対象。送信済みのものは呼ばない） */
  const cleanupFile = useCallback((pendingId: string) => {
    const objectId = uploadedObjectsRef.current.get(pendingId);
    if (objectId) {
      storageClient.discard(objectId).catch((err) => {
        console.error("[useChatMessageSender] cleanup error", err);
      });
      uploadedObjectsRef.current.delete(pendingId);
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
    (file: File, type: Extract<MessageType, "image" | "video" | "file">): ValidationResult => {
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

      const task = uploadToStorage(file, {
        purpose: CHAT_STORAGE_PURPOSES[type],
        scopeId: roomId,
        onProgress: (progress) => {
          updateProgress(messageId, progress);
        },
        onComplete: async (result) => {
          uploadTasksRef.current.delete(messageId);
          uploadedObjectsRef.current.set(messageId, result.objectId);

          updateStatus(messageId, "sending");

          try {
            await sendFileMessage({
              roomId: roomId!,
              content: result.ref,
              type,
              senderId: senderId!,
              metadata,
              messageId,
            });
            updateStatus(messageId, "sent");
            uploadedObjectsRef.current.delete(messageId);
          } catch {
            // 上げたファイルは retry（再アップロード）か dismiss のときに取り消す
            updateStatus(messageId, "failed");
          }
        },
        onError: (err) => {
          // 中止・失敗のときは uploadToStorage が自分で取り消す
          uploadTasksRef.current.delete(messageId);
          if (isStorageUploadCanceled(err)) {
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
        // ファイル再送（再アップロードから）。前回上げて送れなかったファイルは取り消す
        cleanupFile(pendingId);
        removePending(pendingId);
        sendFile(pending.file, message.type as Extract<MessageType, "image" | "video" | "file">);
      } else if (message.content) {
        // アップロード済み・メッセージ送信のみ失敗した場合
        updateStatus(pendingId, "sending");
        try {
          await sendFileMessage({
            roomId,
            content: message.content,
            type: message.type as Extract<MessageType, "image" | "video" | "file">,
            senderId,
            metadata: message.metadata!,
            messageId: pendingId,
          });
          updateStatus(pendingId, "sent");
          uploadedObjectsRef.current.delete(pendingId);
        } catch {
          updateStatus(pendingId, "failed");
        }
      }
    },
    [roomId, senderId, pendingMessages, updateStatus, removePending, sendFile, cleanupFile],
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
