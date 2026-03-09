// src/features/chatRoom/stores/messageSending/types.ts

import type { UploadProgress } from "@/lib/storage/client/clientUploader";

import type { ChatMessage } from "@/features/chatRoom/entities/message";

/** 送信状態 */
export type MessageSendingStatus = "uploading" | "sending" | "sent" | "failed";

/**
 * 楽観的UI 用の送信中メッセージ。
 *
 * ChatMessage を内包し、送信状態を付加する。
 * ChatMessage に新フィールドが追加されても自動的に追従する。
 *
 * message.id は Firestore ドキュメント ID と一致させる（事前生成）。
 * 実メッセージ到着時に id でマッチして pending から除去する。
 */
export type PendingMessage = {
  /** 送信予定のメッセージデータ */
  message: ChatMessage;
  /** 送信状態 */
  status: MessageSendingStatus;
  /** アップロード進捗（status: "uploading" 時のみ有効） */
  uploadProgress?: UploadProgress | null;
  /** ファイルメッセージの再送用（テキストの場合は undefined） */
  file?: File;
};
