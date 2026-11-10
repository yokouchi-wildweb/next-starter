// src/lib/messaging/definition/errors.ts

/**
 * 経路の送信の失敗の分類(lib/mail の MailSendErrorKind と同じ語彙)
 * - transient: 一時。時間を置いて送り直す
 * - permanent: 恒久。送り直しても通らない
 * - unknown: 受付不明。送り直すなら冪等の鍵を付ける
 */
export const CHANNEL_ERROR_KINDS = ["transient", "permanent", "unknown"] as const;

export type ChannelErrorKind = (typeof CHANNEL_ERROR_KINDS)[number];

/**
 * 経路の送信の失敗。経路の send は宛先ごとの結果に入れるか、これを投げる。
 */
export class ChannelError extends Error {
  readonly kind: ChannelErrorKind;
  /** 経路の鍵(email・inApp・line・fork の経路) */
  readonly channel: string;
  /** 機械が読む理由(例 invalid_address・rate_limited・provider_error) */
  readonly reason: string;

  constructor(params: {
    message: string;
    kind: ChannelErrorKind;
    channel: string;
    reason: string;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "ChannelError";
    this.kind = params.kind;
    this.channel = params.channel;
    this.reason = params.reason;
  }
}
