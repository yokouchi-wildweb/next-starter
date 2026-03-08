// src/features/chatRoom/hooks/useReadAt.ts
//
// 既読更新 Hook。
// チャット画面を開いた時に readAt を更新する。
// 手動実装。

import { useEffect, useRef } from "react";

import { updateReadAt } from "@/features/chatRoom/services/client/firestoreClient";

/**
 * チャット画面を開いた時に readAt を更新する。
 *
 * roomId と uid が揃った時点で1回更新する。
 * roomId が変わった場合は再度更新する。
 */
export function useReadAt(
  roomId: string | null,
  uid: string | null,
): void {
  const lastUpdatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomId || !uid) return;
    // 同じルームで重複更新しない
    if (lastUpdatedRef.current === roomId) return;

    lastUpdatedRef.current = roomId;

    updateReadAt(roomId, uid).catch((err) => {
      console.error("[useReadAt]", err);
      // 失敗時はリトライ可能にする
      lastUpdatedRef.current = null;
    });
  }, [roomId, uid]);
}
