// src/lib/mail/webhooks/types.ts

import type { MailProvider } from "../provider";

/**
 * 正規化した事件の種類
 * - sent: provider が受け付けて送った(Resend email.sent・SendGrid processed)
 * - delivered: 受信側のサーバーが受け取った
 * - deferred: 一時的に届かず再試行中(Resend delivery_delayed・SendGrid deferred / blocked)
 * - bounced: 届かなかった(恒久)
 * - complained: 迷惑メールとして報告された
 * - opened / clicked: 開封・クリック(provider 側で計測を入れたときだけ届く。既定で切)
 * - dropped: provider が送らなかった(Resend failed / suppressed・SendGrid dropped)
 * - unsubscribed: provider の仕組みで配信停止された(SendGrid unsubscribe / group_unsubscribe)
 * - other: 上のどれでもない(知らない種類・メール以外の事件)
 */
export type MailWebhookEventType =
  | "sent"
  | "delivered"
  | "deferred"
  | "bounced"
  | "complained"
  | "opened"
  | "clicked"
  | "dropped"
  | "unsubscribed"
  | "other";

/**
 * 正規化した事件。provider の差はここで消える。
 */
export type MailWebhookEvent = {
  provider: MailProvider;
  /** 送信時の send() の providerMessageId と同じ値(得られないときは null) */
  providerMessageId: string | null;
  /** 事件の id(重複の除外に使う。Resend = svix-id、SendGrid = sg_event_id) */
  providerEventId: string;
  type: MailWebhookEventType;
  /** 宛先のメールアドレス(得られないときは null) */
  address: string | null;
  occurredAt: Date;
  /** provider の元の事件(元の種類名・クリックの URL などはここから読む) */
  raw: unknown;
};

/** 検証の失敗の理由 */
export type MailWebhookVerifyFailure =
  | "missing_header"
  | "bad_signature"
  | "stale_timestamp"
  | "bad_payload";

/**
 * webhook の検証の失敗。受け口はこれを 400 / 401 にする。
 */
export class MailWebhookVerifyError extends Error {
  readonly reason: MailWebhookVerifyFailure;
  readonly provider: MailProvider;

  constructor(provider: MailProvider, reason: MailWebhookVerifyFailure, message: string) {
    super(message);
    this.name = "MailWebhookVerifyError";
    this.provider = provider;
    this.reason = reason;
  }
}

/** 受け取ったヘッダ(Request の Headers か、名前 → 値の object) */
export type WebhookHeaders =
  | Headers
  | Record<string, string | string[] | undefined | null>;

/** 生の本文(署名は生の本文で検証するので、JSON を解析し直した物は渡さない) */
export type WebhookRawBody = string | Uint8Array;
