// src/features/chatRoom/utils/validation.ts
//
// チャットメッセージの送信前バリデーション。
// サイズ上限と、用途と同じ許可種別(src/config/app/chat-attachment.config.ts)を見る。
// 種別が空のファイル(ブラウザが判定できない)はここでは通し、サーバーの判定に任せる。

import { CHAT_ATTACHMENT_CONTENT_TYPES } from "@/config/app/chat-attachment.config";
import {
  FILE_MAX_SIZE,
  IMAGE_MAX_SIZE,
  MESSAGE_MAX_LENGTH,
  VIDEO_MAX_SIZE,
} from "@/features/chatRoom/constants/chat";
import { matchesContentType } from "@/lib/storage/contentTypes";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

const REJECTED_TYPE: ValidationResult = { valid: false, reason: "この種類のファイルは送信できません。" };

const isAllowedType = (file: File, type: keyof typeof CHAT_ATTACHMENT_CONTENT_TYPES) =>
  file.type === "" || matchesContentType(file.type, CHAT_ATTACHMENT_CONTENT_TYPES[type]);

/** テキストメッセージのバリデーション */
export function validateTextMessage(content: string): ValidationResult {
  if (!content.trim()) {
    return { valid: false, reason: "メッセージを入力してください。" };
  }
  if (content.length > MESSAGE_MAX_LENGTH) {
    return { valid: false, reason: `メッセージは${MESSAGE_MAX_LENGTH}文字以内で入力してください。` };
  }
  return { valid: true };
}

/** 画像ファイルのバリデーション（種別とサイズ） */
export function validateImageFile(file: File): ValidationResult {
  if (!isAllowedType(file, "image")) return REJECTED_TYPE;
  if (file.size > IMAGE_MAX_SIZE) {
    return { valid: false, reason: `画像ファイルは${IMAGE_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** 動画ファイルのバリデーション（種別とサイズ） */
export function validateVideoFile(file: File): ValidationResult {
  if (!isAllowedType(file, "video")) return REJECTED_TYPE;
  if (file.size > VIDEO_MAX_SIZE) {
    return { valid: false, reason: `動画ファイルは${VIDEO_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** その他ファイルのバリデーション（種別とサイズ） */
export function validateFile(file: File): ValidationResult {
  if (!isAllowedType(file, "file")) return REJECTED_TYPE;
  if (file.size > FILE_MAX_SIZE) {
    return { valid: false, reason: `ファイルは${FILE_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** ファイル種別に応じたバリデーション */
export function validateChatFile(file: File, type: "image" | "video" | "file"): ValidationResult {
  switch (type) {
    case "image":
      return validateImageFile(file);
    case "video":
      return validateVideoFile(file);
    case "file":
      return validateFile(file);
  }
}
