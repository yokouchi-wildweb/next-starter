// src/config/app/chat-attachment.config.ts

/**
 * チャット添付で受け付ける Content-Type(送信前の検査 chatRoom/utils/validation.ts と用途 storageObject/purposes/chatRoom.ts が読む)。
 * 「その他ファイル」の既定は種別を絞らない(表示は配信規則で attachment になる)。
 */
export const CHAT_ATTACHMENT_CONTENT_TYPES = {
  image: ["image/*"],
  video: ["video/*"],
  file: ["application/*", "text/*", "image/*", "video/*", "audio/*", "font/*", "model/*"],
} as const satisfies Record<"image" | "video" | "file", readonly string[]>;
