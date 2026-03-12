// src/features/chatRoom/services/client/bulkMessageClient.ts
//
// 複数ユーザーへの一斉メッセージ送信。
// 各宛先に対して direct ルームの確保 → メッセージ送信を並行実行する。

import type { MessageMetadata } from "@/features/chatRoom/entities/message";
import { createDirectRoom } from "@/features/chatRoom/services/client/firestoreClient";
import { sendTextMessage } from "@/features/chatRoom/services/client/messageClient";
import { pMap } from "@/features/chatRoom/utils/concurrency";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** 一斉送信パラメータ */
export type SendBulkDirectMessageParams = {
  /** 送信者の userId */
  senderId: string;
  /** 宛先ユーザーの userId 配列 */
  targetUserIds: string[];
  /** メッセージ本文 */
  content: string;
  /** メッセージに添付するメタデータ */
  metadata?: MessageMetadata;
  /** 同時実行数の上限（デフォルト: 5） */
  concurrency?: number;
  /** 各宛先の処理完了時に呼ばれるコールバック */
  onProgress?: (progress: BulkSendProgress) => void;
};

/** 個別の送信結果 */
export type BulkSendResultItem = {
  targetUid: string;
  roomId: string;
  status: "success" | "failed";
  error?: Error;
};

/** 進捗情報 */
export type BulkSendProgress = {
  /** 完了件数（成功+失敗） */
  completed: number;
  /** 全体件数 */
  total: number;
  /** 直近の結果 */
  latest: BulkSendResultItem;
};

/** 一斉送信の結果 */
export type BulkSendResult = {
  results: BulkSendResultItem[];
  /** 成功件数 */
  successCount: number;
  /** 失敗件数 */
  failedCount: number;
};

// ---------------------------------------------------------------------------
// 一斉送信
// ---------------------------------------------------------------------------

/**
 * 複数ユーザーに同一のダイレクトメッセージを一斉送信する。
 *
 * 各宛先に対して:
 * 1. createDirectRoom で既存ルームを検索、なければ作成
 * 2. sendTextMessage でメッセージを送信
 *
 * 同時実行数を制限して Firestore のレート制限に配慮する。
 * 個別の失敗は他の宛先に影響せず、結果で確認できる。
 */
export async function sendBulkDirectMessage(
  params: SendBulkDirectMessageParams,
): Promise<BulkSendResult> {
  const {
    senderId,
    targetUserIds,
    content,
    metadata,
    concurrency = 5,
    onProgress,
  } = params;

  let completedCount = 0;

  const results = await pMap(
    targetUserIds,
    async (targetUid): Promise<BulkSendResultItem> => {
      try {
        // 1. ルームの確保（既存 or 新規作成）
        const { roomId } = await createDirectRoom({
          myUid: senderId,
          otherUid: targetUid,
        });

        // 2. メッセージ送信
        await sendTextMessage({
          roomId,
          content,
          senderId,
          metadata,
        });

        const result: BulkSendResultItem = {
          targetUid,
          roomId,
          status: "success",
        };

        completedCount++;
        onProgress?.({
          completed: completedCount,
          total: targetUserIds.length,
          latest: result,
        });

        return result;
      } catch (err) {
        const result: BulkSendResultItem = {
          targetUid,
          roomId: "",
          status: "failed",
          error: err instanceof Error ? err : new Error(String(err)),
        };

        completedCount++;
        onProgress?.({
          completed: completedCount,
          total: targetUserIds.length,
          latest: result,
        });

        return result;
      }
    },
    concurrency,
  );

  const successCount = results.filter((r) => r.status === "success").length;

  return {
    results,
    successCount,
    failedCount: results.length - successCount,
  };
}
