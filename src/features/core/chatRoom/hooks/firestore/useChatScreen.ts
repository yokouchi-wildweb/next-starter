// src/features/chatRoom/hooks/firestore/useChatScreen.ts
//
// チャット画面の統合 Hook。
// useChatMessages + useChatMessageSender + useMergedMessages + useReadAt を
// 一つのインターフェースで提供し、チャット画面のボイラープレートを削減する。
// 手動実装。

"use client";

import { useChatMessages } from "@/features/chatRoom/hooks/firestore/useChatMessages";
import { useChatMessageSender } from "@/features/chatRoom/hooks/firestore/useChatMessageSender";
import type { DisplayMessage } from "@/features/chatRoom/hooks/firestore/useMergedMessages";
import { useMergedMessages } from "@/features/chatRoom/hooks/firestore/useMergedMessages";
import { useReadAt } from "@/features/chatRoom/hooks/firestore/useReadAt";
import type { ValidationResult } from "@/features/chatRoom/utils/validation";
import type { MessageType } from "@/features/chatRoom/entities/message";

export type UseChatScreenReturn = {
  /** 時系列順の統合メッセージ一覧（実 + pending） */
  displayMessages: DisplayMessage[];
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
  /** テキストメッセージを送信する */
  sendText: (content: string) => Promise<ValidationResult>;
  /** ファイル/画像メッセージを送信する */
  sendFile: (file: File, type: Extract<MessageType, "image" | "file">) => ValidationResult;
  /** 失敗したメッセージを再送する */
  retry: (pendingId: string) => Promise<void>;
  /** 失敗したメッセージを破棄する */
  dismiss: (pendingId: string) => void;
  /** 進行中のファイルアップロードをキャンセルする */
  cancelUpload: (pendingId: string) => void;
};

/**
 * チャット画面に必要な機能をまとめて提供する統合 Hook。
 *
 * 内部で以下を接続する:
 * - useChatMessages: 過去メッセージ取得 + 新着購読
 * - useChatMessageSender: テキスト/ファイル送信 + 楽観的UI
 * - useMergedMessages: 実メッセージ + pending の統合
 * - useReadAt: 入室時・滞在中・退出時の既読更新
 *
 * @example
 * ```tsx
 * function ChatScreen({ roomId, uid }: { roomId: string; uid: string }) {
 *   const {
 *     displayMessages, isLoading, hasMore, loadMore,
 *     sendText, sendFile, retry, dismiss, cancelUpload,
 *   } = useChatScreen(roomId, uid);
 *
 *   return (
 *     <div>
 *       {hasMore && <button onClick={loadMore}>過去のメッセージ</button>}
 *       {displayMessages.map((dm) => (
 *         <MessageBubble key={dm.message.id} {...dm} />
 *       ))}
 *       <MessageInput onSendText={sendText} onSendFile={sendFile} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useChatScreen(
  roomId: string | null,
  uid: string | null,
): UseChatScreenReturn {
  // メッセージ取得 + 新着購読
  const {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
  } = useChatMessages(roomId);

  // 送信機能
  const {
    sendText,
    sendFile,
    retry,
    dismiss,
    cancelUpload,
  } = useChatMessageSender(roomId, uid);

  // 実メッセージ + pending の統合
  const { displayMessages } = useMergedMessages(roomId, messages);

  // 既読更新（入室時・滞在中・退出時）
  const latestMessageAt = messages.length > 0
    ? messages[messages.length - 1].createdAt
    : null;
  useReadAt(roomId, uid, { latestMessageAt });

  return {
    displayMessages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    sendText,
    sendFile,
    retry,
    dismiss,
    cancelUpload,
  };
}
