// src/features/chatRoom/hooks/useChatRoomSubscription.ts
//
// 単一ルームのリアルタイム購読 Hook。
// 手動実装（Firestore 直接購読）。
// 注: 自動生成の useChatRoom（API 経由の単発取得）と区別するため
// useChatRoomSubscription という名前にしている。

import { useCallback, useEffect, useState } from "react";

import type { ChatRoom } from "@/features/chatRoom/entities";
import { subscribeRoom } from "@/features/chatRoom/services/client/firestoreClient";

export type UseChatRoomSubscriptionReturn = {
  room: ChatRoom | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * 単一ルームをリアルタイム購読する。
 *
 * チャット画面で現在のルーム情報（参加者、readAt 等）を
 * リアルタイムで反映するために使用する。
 */
export function useChatRoomSubscription(roomId: string | null): UseChatRoomSubscriptionReturn {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    console.error("[useChatRoomSubscription]", err);
    setError(err);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeRoom(
      roomId,
      (updatedRoom) => {
        setRoom(updatedRoom);
        setIsLoading(false);
      },
      handleError,
    );

    return unsubscribe;
  }, [roomId, handleError]);

  return { room, isLoading, error };
}
