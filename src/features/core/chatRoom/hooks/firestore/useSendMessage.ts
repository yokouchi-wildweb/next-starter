// src/features/chatRoom/hooks/useSendMessage.ts
//
// テキストメッセージ送信 Hook。
// 手動実装。

import { useCallback, useState } from "react";

import { sendTextMessage } from "@/features/chatRoom/services/client/messageClient";

export type UseSendMessageReturn = {
  /** メッセージを送信する */
  send: (content: string) => Promise<string | null>;
  /** 送信中フラグ */
  isSending: boolean;
  /** 送信エラー */
  error: Error | null;
};

/**
 * テキストメッセージを送信する Hook。
 *
 * @param roomId - 送信先ルーム ID
 * @param senderId - 送信者の userId
 */
export function useSendMessage(
  roomId: string | null,
  senderId: string | null,
): UseSendMessageReturn {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const send = useCallback(
    async (content: string): Promise<string | null> => {
      if (!roomId || !senderId) return null;

      setIsSending(true);
      setError(null);

      try {
        const messageId = await sendTextMessage({ roomId, content, senderId });
        return messageId;
      } catch (err) {
        console.error("[useSendMessage]", err);
        setError(err as Error);
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [roomId, senderId],
  );

  return { send, isSending, error };
}
