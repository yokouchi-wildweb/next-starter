// src/features/chatRoom/utils/validation.ts
//
// チャットメッセージの送信前バリデーション。

import {
  ALLOWED_FILE_TYPES,
  ALLOWED_IMAGE_TYPES,
  FILE_MAX_SIZE,
  IMAGE_MAX_SIZE,
  MESSAGE_MAX_LENGTH,
} from "@/features/chatRoom/constants/chat";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

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

/** 画像ファイルのバリデーション */
export function validateImageFile(file: File): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return { valid: false, reason: "対応していない画像形式です。jpg, png, gif, webp のみ対応しています。" };
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return { valid: false, reason: `画像ファイルは${IMAGE_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** その他ファイルのバリデーション */
export function validateFile(file: File): ValidationResult {
  if (!ALLOWED_FILE_TYPES.includes(file.type as any)) {
    return { valid: false, reason: "対応していないファイル形式です。pdf, docx, xlsx のみ対応しています。" };
  }
  if (file.size > FILE_MAX_SIZE) {
    return { valid: false, reason: `ファイルは${FILE_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** ファイル種別に応じたバリデーション */
export function validateChatFile(file: File, type: "image" | "file"): ValidationResult {
  return type === "image" ? validateImageFile(file) : validateFile(file);
}
