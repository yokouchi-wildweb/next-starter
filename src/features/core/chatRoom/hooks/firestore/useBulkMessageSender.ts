// src/features/chatRoom/hooks/firestore/useBulkMessageSender.ts
//
// 複数ユーザーへの一斉メッセージ送信フック。
// 送信状態・進捗・結果を管理する。

"use client";

import { useCallback, useRef, useState } from "react";

import type {
  BulkSendProgress,
  BulkSendResult,
  BulkSendResultItem,
} from "@/features/chatRoom/services/client/bulkMessageClient";
import { sendBulkDirectMessage } from "@/features/chatRoom/services/client/bulkMessageClient";
import type { MessageMetadata } from "@/features/chatRoom/entities/message";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 送信状態 */
export type BulkSendStatus = "idle" | "sending" | "done";

/** フックの送信パラメータ */
export type BulkSendParams = {
  /** 宛先ユーザーの userId 配列 */
  targetUserIds: string[];
  /** メッセージ本文 */
  content: string;
  /** メッセージに添付するメタデータ */
  metadata?: MessageMetadata;
  /** 同時実行数の上限（デフォルト: 5） */
  concurrency?: number;
};

/** フックの戻り値 */
export type UseBulkMessageSenderReturn = {
  /** 一斉送信を実行する */
  send: (params: BulkSendParams) => Promise<BulkSendResult>;
  /** 現在の送信状態 */
  status: BulkSendStatus;
  /** 進捗情報（送信中のみ） */
  progress: BulkSendProgress | null;
  /** 最終結果（送信完了後） */
  result: BulkSendResult | null;
  /** 状態をリセットする */
  reset: () => void;
};

// ---------------------------------------------------------------------------
// フック
// ---------------------------------------------------------------------------

/**
 * 複数ユーザーへの一斉メッセージ送信を管理するフック。
 *
 * @param senderId - 送信者の userId
 *
 * @example
 * ```tsx
 * const { send, status, progress, result } = useBulkMessageSender(currentUser.uid);
 *
 * const handleSend = async () => {
 *   const result = await send({
 *     targetUserIds: selectedUserIds,
 *     content: messageText,
 *   });
 *   console.log(`${result.successCount}件成功, ${result.failedCount}件失敗`);
 * };
 *
 * // 進捗表示
 * if (status === "sending" && progress) {
 *   return <p>{progress.completed} / {progress.total} 件送信中...</p>;
 * }
 * ```
 */
export function useBulkMessageSender(
  senderId: string,
): UseBulkMessageSenderReturn {
  const [status, setStatus] = useState<BulkSendStatus>("idle");
  const [progress, setProgress] = useState<BulkSendProgress | null>(null);
  const [result, setResult] = useState<BulkSendResult | null>(null);

  // 送信中の二重実行を防止
  const isSendingRef = useRef(false);

  const send = useCallback(
    async (params: BulkSendParams): Promise<BulkSendResult> => {
      if (isSendingRef.current) {
        return { results: [], successCount: 0, failedCount: 0 };
      }

      isSendingRef.current = true;
      setStatus("sending");
      setProgress(null);
      setResult(null);

      try {
        const bulkResult = await sendBulkDirectMessage({
          senderId,
          targetUserIds: params.targetUserIds,
          content: params.content,
          metadata: params.metadata,
          concurrency: params.concurrency,
          onProgress: setProgress,
        });

        setResult(bulkResult);
        setStatus("done");

        return bulkResult;
      } finally {
        isSendingRef.current = false;
      }
    },
    [senderId],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setProgress(null);
    setResult(null);
  }, []);

  return { send, status, progress, result, reset };
}
