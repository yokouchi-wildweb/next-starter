// src/features/chatRoom/entities/message.ts
//
// chatMessage（サブコレクション）の型定義。
// domain.json では対応できないため手動で管理する。

/** メッセージ種別 */
export type MessageType = "text" | "image" | "file" | "system";

/** チャットルーム種別 */
export type ChatRoomType = "direct" | "group";

/**
 * ファイル・画像メッセージの付加情報
 */
export type MessageMetadata = {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
};

/**
 * chatRoom に冗長保存される最新メッセージのスナップショット。
 * 一覧画面での表示・ソートに使用する。
 */
export type LastMessageSnapshot = {
  type: MessageType;
  content: string;
  senderId: string;
  createdAt: Date;
};

/**
 * chat_rooms/{roomId}/messages/{messageId}
 *
 * Firestore サブコレクションのメッセージドキュメント。
 * converter により Timestamp は Date に変換済みの状態で扱う。
 */
export type ChatMessage = {
  id: string;
  type: MessageType;
  content: string;
  senderId: string;
  metadata: MessageMetadata | null;
  createdAt: Date;
  /** 編集済みの場合の編集日時 */
  editedAt: Date | null;
  /** 論理削除日時 */
  deletedAt: Date | null;
};

/**
 * readAt マップの型。
 * キーは userId、値はそのユーザーの最終閲覧時刻。
 */
export type ReadAtMap = Record<string, Date>;

// ---------------------------------------------------------------------------
// 参加者プロフィール解決
// ---------------------------------------------------------------------------

/**
 * 参加者の表示情報。
 * ダウンストリームが resolver で返すデータの型。
 */
export type ParticipantProfile = {
  name: string;
  avatarUrl?: string;
};

/**
 * 参加者 UID 配列からプロフィール情報をバッチ取得する関数の型。
 * ダウンストリームが自プロジェクトの User モデルに合わせて実装する。
 */
export type ParticipantResolver = (
  uids: string[],
) => Promise<Map<string, ParticipantProfile>>;

/**
 * メッセージのサブコレクションパス
 */
export const messagesSubcollectionPath = (roomId: string) =>
  `chat_rooms/${roomId}/messages` as const;
