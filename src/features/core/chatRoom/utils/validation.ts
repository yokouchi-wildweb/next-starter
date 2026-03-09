// src/features/chatRoom/utils/validation.ts
//
// チャットメッセージの送信前バリデーション。
// ベーステンプレートではサイズ上限のみチェックする。
// ファイル種別の制限はダウンストリームで必要に応じて追加する。

import {
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

/** 画像ファイルのバリデーション（サイズのみ） */
export function validateImageFile(file: File): ValidationResult {
  if (file.size > IMAGE_MAX_SIZE) {
    return { valid: false, reason: `画像ファイルは${IMAGE_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** その他ファイルのバリデーション（サイズのみ） */
export function validateFile(file: File): ValidationResult {
  if (file.size > FILE_MAX_SIZE) {
    return { valid: false, reason: `ファイルは${FILE_MAX_SIZE / (1024 * 1024)}MB以内にしてください。` };
  }
  return { valid: true };
}

/** ファイル種別に応じたバリデーション */
export function validateChatFile(file: File, type: "image" | "file"): ValidationResult {
  return type === "image" ? validateImageFile(file) : validateFile(file);
}
