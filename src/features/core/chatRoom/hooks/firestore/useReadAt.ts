// src/features/chatRoom/hooks/useReadAt.ts
//
// 既読更新 Hook。
// チャット画面の入室時と退出時に readAt を更新する。
// 手動実装。

import { useEffect, useRef } from "react";

import { updateReadAt } from "@/features/chatRoom/services/client/firestoreClient";

/**
 * チャット画面の入室時と退出時に readAt を更新する。
 *
 * - 入室時: roomId と uid が揃った時点で1回更新
 * - 退出時: アンマウント（または roomId 変更）時に更新し、
 *   チャット中に届いた新着メッセージを既読にする
 */
export function useReadAt(
  roomId: string | null,
  uid: string | null,
): void {
  const lastUpdatedRef = useRef<string | null>(null);
  // cleanup 時に最新の値を参照するため ref で保持
  const roomIdRef = useRef(roomId);
  const uidRef = useRef(uid);
  roomIdRef.current = roomId;
  uidRef.current = uid;

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

    return () => {
      // 退出時に既読更新（チャット中に届いた新着を既読にする）
      if (roomIdRef.current && uidRef.current) {
        updateReadAt(roomIdRef.current, uidRef.current).catch((err) => {
          console.error("[useReadAt] cleanup", err);
        });
      }
      lastUpdatedRef.current = null;
    };
  }, [roomId, uid]);
}
