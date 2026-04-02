// src/lib/x/errors.ts

import { ApiResponseError } from "twitter-api-v2";

// ────────────────────────────────────────
// エラーコード
// ────────────────────────────────────────

/** X API エラーの分類コード */
export type XApiErrorCode =
  | "rate_limited"
  | "token_expired"
  | "forbidden"
  | "not_found"
  | "duplicate"
  | "suspended"
  | "unknown";

// ────────────────────────────────────────
// エラークラス
// ────────────────────────────────────────

/**
 * X API のエラーをラップしたエラークラス。
 * リトライ可能かどうか、リトライまでの秒数などを提供する。
 */
export class XApiError extends Error {
  /** エラー分類コード */
  readonly code: XApiErrorCode;
  /** リトライ可能かどうか */
  readonly retryable: boolean;
  /** リトライまでの秒数（rate_limited の場合のみ） */
  readonly retryAfter?: number;
  /** HTTP ステータスコード */
  readonly statusCode?: number;
  /** 元のエラー */
  readonly cause?: Error;

  constructor(params: {
    message: string;
    code: XApiErrorCode;
    retryable: boolean;
    retryAfter?: number;
    statusCode?: number;
    cause?: Error;
  }) {
    super(params.message);
    this.name = "XApiError";
    this.code = params.code;
    this.retryable = params.retryable;
    this.retryAfter = params.retryAfter;
    this.statusCode = params.statusCode;
    this.cause = params.cause;
  }
}

// ────────────────────────────────────────
// 変換
// ────────────────────────────────────────

/**
 * twitter-api-v2 の ApiResponseError を XApiError に変換する。
 */
function classifyApiResponseError(error: ApiResponseError): XApiError {
  // レート制限 (429)
  if (error.rateLimitError || error.code === 429) {
    const resetTimestamp = error.rateLimit?.reset;
    const retryAfter = resetTimestamp
      ? Math.max(0, resetTimestamp - Math.floor(Date.now() / 1000))
      : undefined;

    return new XApiError({
      message: `X API レート制限に到達しました${retryAfter ? `（${retryAfter}秒後にリトライ可能）` : ""}`,
      code: "rate_limited",
      retryable: true,
      retryAfter,
      statusCode: 429,
      cause: error,
    });
  }

  // 認証エラー (401)
  if (error.isAuthError || error.code === 401) {
    return new XApiError({
      message: "X API の認証に失敗しました（トークンが期限切れまたは無効です）",
      code: "token_expired",
      retryable: false,
      statusCode: 401,
      cause: error,
    });
  }

  // 禁止 (403) — アカウント凍結等
  if (error.code === 403) {
    const isSuspended = error.errors?.some(
      (e) => "code" in e && (e.code === 64 || e.code === 326),
    );

    if (isSuspended) {
      return new XApiError({
        message: "X アカウントが凍結されています",
        code: "suspended",
        retryable: false,
        statusCode: 403,
        cause: error,
      });
    }

    return new XApiError({
      message: "X API へのアクセスが拒否されました",
      code: "forbidden",
      retryable: false,
      statusCode: 403,
      cause: error,
    });
  }

  // 重複投稿 (403 with duplicate status code)
  if (error.errors?.some((e) => "code" in e && e.code === 187)) {
    return new XApiError({
      message: "同一内容のツイートが既に投稿されています",
      code: "duplicate",
      retryable: false,
      statusCode: error.code,
      cause: error,
    });
  }

  // 未検出 (404)
  if (error.code === 404) {
    return new XApiError({
      message: "指定されたリソースが見つかりません",
      code: "not_found",
      retryable: false,
      statusCode: 404,
      cause: error,
    });
  }

  // サーバーエラー (5xx) — リトライ可能
  if (error.code >= 500) {
    return new XApiError({
      message: `X API サーバーエラー (${error.code})`,
      code: "unknown",
      retryable: true,
      statusCode: error.code,
      cause: error,
    });
  }

  // その他
  return new XApiError({
    message: error.message || "X API で不明なエラーが発生しました",
    code: "unknown",
    retryable: false,
    statusCode: error.code,
    cause: error,
  });
}

/**
 * 任意のエラーを XApiError に変換する。
 * twitter-api-v2 の ApiResponseError であれば分類し、それ以外は unknown としてラップする。
 */
export function toXApiError(error: unknown): XApiError {
  if (error instanceof XApiError) {
    return error;
  }

  if (error instanceof ApiResponseError) {
    return classifyApiResponseError(error);
  }

  const message = error instanceof Error ? error.message : String(error);
  return new XApiError({
    message,
    code: "unknown",
    retryable: false,
    cause: error instanceof Error ? error : undefined,
  });
}

// ────────────────────────────────────────
// 判別ヘルパー
// ────────────────────────────────────────

/** エラーが XApiError かどうか */
export function isXApiError(error: unknown): error is XApiError {
  return error instanceof XApiError;
}

/** レート制限エラーかどうか */
export function isXRateLimited(error: unknown): boolean {
  if (error instanceof XApiError) return error.code === "rate_limited";
  if (error instanceof ApiResponseError) return error.rateLimitError || error.code === 429;
  return false;
}

/** トークン期限切れエラーかどうか */
export function isXTokenExpired(error: unknown): boolean {
  if (error instanceof XApiError) return error.code === "token_expired";
  if (error instanceof ApiResponseError) return error.isAuthError || error.code === 401;
  return false;
}

/** アカウント凍結エラーかどうか */
export function isXSuspended(error: unknown): boolean {
  if (error instanceof XApiError) return error.code === "suspended";
  if (error instanceof ApiResponseError) {
    return error.code === 403 && (error.errors?.some(
      (e) => "code" in e && (e.code === 64 || e.code === 326),
    ) ?? false);
  }
  return false;
}

/** リトライ可能なエラーかどうか */
export function isXRetryable(error: unknown): boolean {
  if (error instanceof XApiError) return error.retryable;
  if (error instanceof ApiResponseError) return error.rateLimitError || error.code >= 500;
  return false;
}
