// src/lib/firestore/client/errors.ts
//
// Firestore クライアント操作のエラーを正規化する。
// lib/errors/httpError.ts の normalizeHttpError と同じ役割を、
// Firestore SDK のエラーに対して担う。

import { FirestoreError } from "firebase/firestore";

import type { FirestoreClientError } from "../types";

/** Firestore エラーコード → 日本語メッセージ */
const ERROR_MESSAGES: Record<string, string> = {
  "permission-denied": "この操作を行う権限がありません",
  "not-found": "データが見つかりません",
  "already-exists": "データがすでに存在します",
  unauthenticated: "認証が必要です。ログインしてください",
  "resource-exhausted": "リクエスト上限に達しました。しばらくしてから再試行してください",
  unavailable: "サーバーに接続できません。ネットワーク接続を確認してください",
  "deadline-exceeded": "操作がタイムアウトしました。再試行してください",
  cancelled: "操作がキャンセルされました",
  "data-loss": "データが失われました。管理者に連絡してください",
  "failed-precondition": "操作の前提条件が満たされていません",
  "invalid-argument": "不正なデータが送信されました",
};

const DEFAULT_MESSAGE = "エラーが発生しました";

/**
 * Firestore 操作のエラーを FirestoreClientError に正規化する
 */
export function normalizeFirestoreError(
  error: unknown,
  fallbackMessage: string = DEFAULT_MESSAGE,
): FirestoreClientError {
  if (error instanceof FirestoreError) {
    return {
      message: ERROR_MESSAGES[error.code] ?? fallbackMessage,
      code: error.code,
      cause: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallbackMessage,
      cause: error,
    };
  }

  return {
    message: fallbackMessage,
    cause: error,
  };
}
