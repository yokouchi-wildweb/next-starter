// src/lib/mail/errors.ts

import type { MailProvider } from "./provider";

/**
 * 送信の失敗の分類
 * - transient: 一時(接続できなかった・429・5xx)。時間を置いて送り直してよい
 * - permanent: 恒久(宛先不正・429 以外の 4xx・送信前の入力の誤り)。送り直しても通らない
 * - unknown: 受付不明(応答が得られず、provider が受け付けたか分からない)。送り直すなら冪等の鍵を付ける
 */
export type MailSendErrorKind = "transient" | "permanent" | "unknown";

/**
 * メール送信の失敗。message は従来の「メール送信に失敗しました（<provider>）: …」を保つ。
 */
export class MailSendError extends Error {
  readonly kind: MailSendErrorKind;
  readonly provider: MailProvider;
  /** provider の HTTP 状態(応答が無いときは null) */
  readonly status: number | null;

  constructor(params: {
    message: string;
    kind: MailSendErrorKind;
    provider: MailProvider;
    status: number | null;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "MailSendError";
    this.kind = params.kind;
    this.provider = params.provider;
    this.status = params.status;
  }
}

/**
 * HTTP 状態から失敗の分類を決める。状態が無い(応答が無い)ときは unknown。
 */
export function classifyStatus(status: number | null | undefined): MailSendErrorKind {
  if (typeof status !== "number") return "unknown";
  if (status === 429 || status >= 500) return "transient";
  if (status >= 400) return "permanent";
  return "unknown";
}

/** 要求が相手に届く前に止まったと分かる接続の誤り(送られていないので一時) */
const CONNECT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

/**
 * 応答の無い誤り(ネットワーク層)の分類。接続前に止まったものは transient、
 * それ以外(タイムアウト・接続の切断など、送られたか分からないもの)は unknown。
 */
export function classifyNetworkError(error: unknown): MailSendErrorKind {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === "string" && CONNECT_ERROR_CODES.has(code)) return "transient";
  return "unknown";
}
