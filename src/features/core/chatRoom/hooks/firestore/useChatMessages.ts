// src/features/chatRoom/hooks/useChatMessages.ts
//
// メッセージ一覧の管理 Hook。
// 初回の過去メッセージ取得 + 新着メッセージのリアルタイム購読を統合する。
// 手動実装。

import { useCallback, useEffect, useRef, useState } from "react";

import type { QueryDocumentSnapshot } from "firebase/firestore";

import type { ChatMessage } from "@/features/chatRoom/entities/message";
import {
  fetchPastMessages,
  subscribeNewMessages,
} from "@/features/chatRoom/services/client/messageClient";

export type UseChatMessagesReturn = {
  /** 時系列順（古い→新しい）のメッセージ一覧 */
  messages: ChatMessage[];
  /** 初回読み込み中 */
  isLoading: boolean;
  /** 過去メッセージ読み込み中 */
  isLoadingMore: boolean;
  /** これ以上過去のメッセージがあるか */
  hasMore: boolean;
  /** エラー */
  error: Error | null;
  /** 過去メッセージを追加取得する */
  loadMore: () => Promise<void>;
};

/**
 * チャットメッセージを管理する。
 *
 * 1. マウント時に最新メッセージを取得（createdAt desc）
 * 2. 取得完了後、新着メッセージのリアルタイム購読を開始
 * 3. loadMore で過去メッセージを追加取得（カーソルベースページネーション）
 */
export function useChatMessages(roomId: string | null): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // カーソル（過去方向ページネーション用）
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  // 新着購読の解除関数
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 初回取得 + 新着購読の開始
  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setIsLoading(false);
      setHasMore(true);
      cursorRef.current = null;
      return;
    }

    let isActive = true;

    async function init() {
      setIsLoading(true);
      setError(null);
      setMessages([]);
      cursorRef.current = null;

      try {
        const result = await fetchPastMessages(roomId!);

        if (!isActive) return;

        setMessages(result.messages);
        setHasMore(result.hasMore);
        cursorRef.current = result.nextCursor;
        setIsLoading(false);

        // 新着メッセージの購読開始
        // 取得した最新メッセージの createdAt 以降を購読
        const latestCreatedAt = result.messages.length > 0
          ? result.messages[result.messages.length - 1].createdAt
          : new Date(0);

        unsubscribeRef.current = subscribeNewMessages(
          roomId!,
          latestCreatedAt,
          (snapshot) => {
            if (!isActive) return;
            const added = snapshot.changes
              .filter((c) => c.type === "added")
              .map((c) => c.doc);

            if (added.length > 0) {
              setMessages((prev) => {
                // 重複排除（初回取得分と購読開始の間に届いたメッセージ）
                const existingIds = new Set(prev.map((m) => m.id));
                const newMessages = added.filter((m) => !existingIds.has(m.id));
                return newMessages.length > 0 ? [...prev, ...newMessages] : prev;
              });
            }
          },
          (err) => {
            if (!isActive) return;
            console.error("[useChatMessages] subscription error", err);
            setError(err);
          },
        );
      } catch (err) {
        if (!isActive) return;
        console.error("[useChatMessages] init error", err);
        setError(err as Error);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      isActive = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [roomId]);

  // 過去メッセージの追加取得
  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const result = await fetchPastMessages(roomId, cursorRef.current);

      setMessages((prev) => [...result.messages, ...prev]);
      setHasMore(result.hasMore);
      cursorRef.current = result.nextCursor;
    } catch (err) {
      console.error("[useChatMessages] loadMore error", err);
      setError(err as Error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [roomId, hasMore, isLoadingMore]);

  return { messages, isLoading, isLoadingMore, hasMore, error, loadMore };
}
