// src/features/chatRoom/hooks/useSendChatFile.ts
//
// ファイル/画像メッセージ送信 Hook。
// clientUploader（既存）でアップロード → sendFileMessage でメッセージ作成。
// 手動実装。

import { useCallback, useRef, useState } from "react";

import type { UploadProgress, UploadTaskHandle } from "@/lib/storage/client/clientUploader";
import { clientUploader } from "@/lib/storage/client/clientUploader";
import { directStorageClient } from "@/lib/storage/client/directStorageClient";

import type { MessageMetadata, MessageType } from "@/features/chatRoom/entities/message";
import { sendFileMessage } from "@/features/chatRoom/services/client/messageClient";

export type UseSendChatFileReturn = {
  /** ファイルを送信する */
  send: (file: File, type: Extract<MessageType, "image" | "file">) => void;
  /** アップロード進捗 */
  progress: UploadProgress | null;
  /** アップロード + 送信中フラグ */
  isSending: boolean;
  /** エラー */
  error: Error | null;
  /** アップロードをキャンセルする */
  cancel: () => void;
};

/**
 * ファイル/画像メッセージを送信する Hook。
 *
 * フロー:
 * 1. clientUploader で Firebase Storage にアップロード（進捗表示対応）
 * 2. 完了後 sendFileMessage でメッセージ作成
 * 3. 失敗/キャンセル時はアップロード済みファイルを削除
 *
 * @param roomId - 送信先ルーム ID
 * @param senderId - 送信者の userId
 */
export function useSendChatFile(
  roomId: string | null,
  senderId: string | null,
): UseSendChatFileReturn {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const taskRef = useRef<UploadTaskHandle | null>(null);
  const uploadedPathRef = useRef<string | null>(null);

  const cleanupUploadedFile = useCallback(() => {
    if (uploadedPathRef.current) {
      directStorageClient.remove(uploadedPathRef.current).catch((err) => {
        console.error("[useSendChatFile] cleanup error", err);
      });
      uploadedPathRef.current = null;
    }
  }, []);

  const send = useCallback(
    (file: File, type: Extract<MessageType, "image" | "file">) => {
      if (!roomId || !senderId) return;

      setIsSending(true);
      setError(null);
      setProgress(null);
      uploadedPathRef.current = null;

      // Storage パス: chat/{roomId}/{UUID+拡張子}
      const basePath = `chat/${roomId}`;

      taskRef.current = clientUploader.upload(file, {
        basePath,
        onProgress: (p) => setProgress(p),
        onComplete: async (result) => {
          uploadedPathRef.current = result.path;
          taskRef.current = null;

          try {
            const metadata: MessageMetadata = {
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || undefined,
            };

            await sendFileMessage({
              roomId: roomId!,
              content: result.url,
              type,
              senderId: senderId!,
              metadata,
            });

            setProgress(null);
            setIsSending(false);
            uploadedPathRef.current = null;
          } catch (err) {
            console.error("[useSendChatFile] send error", err);
            setError(err as Error);
            setIsSending(false);
            cleanupUploadedFile();
          }
        },
        onError: (err) => {
          taskRef.current = null;
          // storage/canceled はキャンセル操作なのでエラー扱いしない
          if ("code" in err && (err as any).code === "storage/canceled") {
            setIsSending(false);
            setProgress(null);
            return;
          }
          console.error("[useSendChatFile] upload error", err);
          setError(err);
          setIsSending(false);
        },
      });
    },
    [roomId, senderId, cleanupUploadedFile],
  );

  const cancel = useCallback(() => {
    taskRef.current?.cancel();
    taskRef.current = null;
    setIsSending(false);
    setProgress(null);
    cleanupUploadedFile();
  }, [cleanupUploadedFile]);

  return { send, progress, isSending, error, cancel };
}
