// src/features/chatRoom/hooks/useReadAt.ts
//
// 既読更新 Hook。
// チャット画面の入室時・滞在中・退出時に readAt を更新する。
// 手動実装。

import { useEffect, useRef } from "react";

import { updateReadAt } from "@/features/chatRoom/services/client/firestoreClient";

/** useReadAt のオプション */
export type UseReadAtOptions = {
  /**
   * 最新メッセージの日時。
   * この値が変化すると readAt を再更新する（チャット滞在中の新着対応）。
   *
   * @example
   * ```ts
   * const { messages } = useChatMessages(roomId);
   * useReadAt(roomId, uid, {
   *   latestMessageAt: messages[messages.length - 1]?.createdAt ?? null,
   * });
   * ```
   */
  latestMessageAt?: Date | null;
};

/**
 * チャット画面の入室時・滞在中・退出時に readAt を更新する。
 *
 * - 入室時: roomId と uid が揃った時点で1回更新
 * - 滞在中: latestMessageAt が変化するたびにデバウンスで更新
 * - 退出時: アンマウント（または roomId 変更）時に更新
 */
export function useReadAt(
  roomId: string | null,
  uid: string | null,
  options?: UseReadAtOptions,
): void {
  const lastUpdatedRef = useRef<string | null>(null);
  // cleanup 時に最新の値を参照するため ref で保持
  const roomIdRef = useRef(roomId);
  const uidRef = useRef(uid);
  roomIdRef.current = roomId;
  uidRef.current = uid;

  // 入室時 + 退出時
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

  // 滞在中の新着メッセージ受信時
  const latestMessageAt = options?.latestMessageAt;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomId || !uid || !latestMessageAt) return;
    // 入室直後の初回は上の effect で処理済みなのでスキップ
    if (lastUpdatedRef.current !== roomId) return;

    // デバウンス: 連続受信時は最後の1回だけ更新
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateReadAt(roomId, uid).catch((err) => {
        console.error("[useReadAt] message update", err);
      });
    }, 1000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [roomId, uid, latestMessageAt]);
}
