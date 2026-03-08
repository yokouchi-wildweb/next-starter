// src/features/chatRoom/hooks/useChatRooms.ts
//
// ルーム一覧のリアルタイム購読 Hook。
// 手動実装（Firestore 直接購読）。

import { useCallback, useEffect, useState } from "react";

import type { ChatRoom } from "@/features/chatRoom/entities";
import { subscribeRooms } from "@/features/chatRoom/services/client/firestoreClient";

export type UseChatRoomsReturn = {
  rooms: ChatRoom[];
  isLoading: boolean;
  error: Error | null;
};

/**
 * ユーザーが参加しているルーム一覧をリアルタイム購読する。
 *
 * lastMessageSnapshot.createdAt 降順でソートされた状態で返される。
 */
export function useChatRooms(uid: string | null): UseChatRoomsReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    console.error("[useChatRooms]", err);
    setError(err);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!uid) {
      setRooms([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeRooms(
      uid,
      (updatedRooms) => {
        setRooms(updatedRooms);
        setIsLoading(false);
      },
      handleError,
    );

    return unsubscribe;
  }, [uid, handleError]);

  return { rooms, isLoading, error };
}
