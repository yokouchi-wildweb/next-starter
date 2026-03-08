// src/features/chatRoom/stores/messageSending/types.ts

import type { MessageMetadata, MessageType } from "@/features/chatRoom/entities/message";

/** 送信状態 */
export type MessageSendingStatus = "sending" | "sent" | "failed";

/**
 * 楽観的UI 用の送信中メッセージ。
 *
 * id は Firestore ドキュメント ID と一致させる（事前生成）。
 * 実メッセージ到着時に id でマッチして pending から除去する。
 */
export type PendingMessage = {
  /** Firestore ドキュメント ID と一致するメッセージ ID */
  id: string;
  roomId: string;
  type: MessageType;
  content: string;
  senderId: string;
  metadata: MessageMetadata | null;
  status: MessageSendingStatus;
  /** クライアント側のタイムスタンプ（表示順序用） */
  createdAt: Date;
  /** ファイルメッセージの再送用（テキストの場合は undefined） */
  file?: File;
};
