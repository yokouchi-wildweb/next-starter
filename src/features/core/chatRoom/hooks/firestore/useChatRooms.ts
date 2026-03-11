// src/features/chatRoom/hooks/useChatRooms.ts
//
// ルーム一覧のリアルタイム購読 Hook。
// 手動実装（Firestore 直接購読）。

import { useCallback, useEffect, useState } from "react";

import type { ChatRoom } from "@/features/chatRoom/entities";
import type { SubscribeRoomsOptions } from "@/features/chatRoom/services/client/firestoreClient";
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
 * options.type / options.excludeTypes でルームタイプをフィルタリングできる。
 */
export function useChatRooms(uid: string | null, options?: SubscribeRoomsOptions): UseChatRoomsReturn {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: Error) => {
    console.error("[useChatRooms]", err);
    setError(err);
    setIsLoading(false);
  }, []);

  // 安定した依存値を生成（配列の参照変更による不要な再購読を防ぐ）
  const typeKey = Array.isArray(options?.type)
    ? options.type.slice().sort().join(",")
    : options?.type ?? "";
  const excludeKey = options?.excludeTypes?.slice().sort().join(",") ?? "";

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
      options,
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, handleError, typeKey, excludeKey]);

  return { rooms, isLoading, error };
}
