// src/features/chatRoom/constants/chat.ts
//
// チャット機能の定数定義。手動管理。

/** メッセージ本文の最大文字数（セキュリティルールと合わせる） */
export const MESSAGE_MAX_LENGTH = 5000;

/** 1回のページネーションで取得するメッセージ数 */
export const MESSAGES_PER_PAGE = 30;

/** グループチャットの最大参加者数 */
export const MAX_PARTICIPANTS = 30;

/** 画像ファイルの最大サイズ（バイト） */
export const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** その他ファイルの最大サイズ（バイト） */
export const FILE_MAX_SIZE = 20 * 1024 * 1024; // 20MB

/** 画像リサイズ時の最大幅（ピクセル） */
export const IMAGE_MAX_WIDTH = 1920;

/** Firebase Storage のチャットファイルパス */
export const chatStoragePath = (roomId: string, messageId: string, fileName: string) =>
  `chat/${roomId}/${messageId}/${fileName}` as const;

/** システムメッセージ: ルーム作成時 */
export const SYSTEM_MESSAGE_ROOM_CREATED = "ルームが作成されました";

/** システムメッセージ: 参加者追加時（{name} はプレースホルダ） */
export const SYSTEM_MESSAGE_PARTICIPANT_ADDED = "{name}が参加しました";

/** システムメッセージ: 参加者退出時（{name} はプレースホルダ） */
export const SYSTEM_MESSAGE_PARTICIPANT_REMOVED = "{name}が退出しました";
