// src/lib/line/errors.ts
//
// Messaging API の失敗の型。状態(status)と「時間を置いて送り直してよいか」(retryable)を持つ。
// - 429・5xx・応答なし(ネットワークの失敗, status null)= retryable true
// - その他の 4xx = retryable false(送り直しても通らない)
// - message は前と同じ文(`LINE Messaging API エラー: <status> <body>`)。LINE の誤りの本文は body に残す

export type LineApiErrorInit = {
  /** HTTP の状態。応答が無い(fetch が投げた)ときは null */
  status: number | null;
  /** LINE の誤りの本文(応答なしは null) */
  body: string | null;
  cause?: unknown;
};

/** 状態から送り直してよいかを決める(null = 応答なし = true) */
export function isRetryableLineStatus(status: number | null): boolean {
  if (status === null) return true;
  return status === 429 || status >= 500;
}

export class LineApiError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;
  readonly body: string | null;

  constructor(init: LineApiErrorInit) {
    const detail =
      init.status === null
        ? `応答なし ${init.cause instanceof Error ? init.cause.message : String(init.cause ?? "")}`.trimEnd()
        : `${init.status} ${init.body ?? ""}`;
    super(`LINE Messaging API エラー: ${detail}`, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "LineApiError";
    this.status = init.status;
    this.body = init.body;
    this.retryable = isRetryableLineStatus(init.status);
  }
}
