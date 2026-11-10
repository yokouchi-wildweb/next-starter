// src/lib/mail/webhooks/sendgrid.ts
//
// SendGrid の Event Webhook(ECDSA の署名)の検証と正規化。
// - 署名 = ECDSA(P-256)+ SHA256 を `${X-Twilio-Email-Event-Webhook-Timestamp}${生の本文}` にかけた物(base64 の DER)
// - 公開鍵は Signed Event Webhook を有効にすると出る値(base64 の DER。PEM も受ける)
// - 本文は事件の配列。重複は sg_event_id で除く
// - @sendgrid/eventwebhook は入れず、node:crypto で検証する

import { createPublicKey, verify, type KeyObject } from "node:crypto";

import { rawBodyToBuffer, readWebhookHeader } from "./shared";
import {
  MailWebhookVerifyError,
  type MailWebhookEvent,
  type MailWebhookEventType,
  type WebhookHeaders,
  type WebhookRawBody,
} from "./types";

export const SENDGRID_SIGNATURE_HEADER = "X-Twilio-Email-Event-Webhook-Signature";
export const SENDGRID_TIMESTAMP_HEADER = "X-Twilio-Email-Event-Webhook-Timestamp";

/** SendGrid の事件(使う所だけ) */
export type SendGridWebhookEvent = {
  event: string;
  email?: string;
  timestamp?: number;
  sg_event_id?: string;
  sg_message_id?: string;
  [key: string]: unknown;
};

export type VerifySendGridWebhookParams = {
  rawBody: WebhookRawBody;
  headers: WebhookHeaders;
  /** 検証の公開鍵(base64 の DER、または PEM) */
  publicKey: string;
};

function toPublicKey(publicKey: string): KeyObject {
  const trimmed = publicKey.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return createPublicKey(trimmed);
  }
  return createPublicKey({ key: Buffer.from(trimmed, "base64"), format: "der", type: "spki" });
}

/**
 * SendGrid の webhook を検証し、解析した事件の配列を返す。
 * 失敗は MailWebhookVerifyError で投げる。
 */
export function verifySendGridWebhook(params: VerifySendGridWebhookParams): SendGridWebhookEvent[] {
  const { rawBody, headers, publicKey } = params;

  const signature = readWebhookHeader(headers, SENDGRID_SIGNATURE_HEADER);
  const timestamp = readWebhookHeader(headers, SENDGRID_TIMESTAMP_HEADER);
  if (!signature || !timestamp) {
    throw new MailWebhookVerifyError("sendgrid", "missing_header", "SendGrid の署名のヘッダが欠けています");
  }

  let key: KeyObject;
  try {
    key = toPublicKey(publicKey);
  } catch {
    throw new MailWebhookVerifyError("sendgrid", "bad_signature", "公開鍵を読めません");
  }

  const body = rawBodyToBuffer(rawBody);
  const signed = Buffer.concat([Buffer.from(timestamp, "utf8"), body]);
  let ok = false;
  try {
    ok = verify("sha256", signed, key, Buffer.from(signature, "base64"));
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new MailWebhookVerifyError("sendgrid", "bad_signature", "SendGrid の署名が合いません");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString("utf8"));
  } catch {
    throw new MailWebhookVerifyError("sendgrid", "bad_payload", "本文が JSON ではありません");
  }
  if (!Array.isArray(parsed)) {
    throw new MailWebhookVerifyError("sendgrid", "bad_payload", "本文が事件の配列ではありません");
  }
  return parsed as SendGridWebhookEvent[];
}

const SENDGRID_TYPE_MAP: Record<string, MailWebhookEventType> = {
  processed: "sent",
  delivered: "delivered",
  deferred: "deferred",
  blocked: "deferred",
  bounce: "bounced",
  dropped: "dropped",
  spamreport: "complained",
  open: "opened",
  click: "clicked",
  unsubscribe: "unsubscribed",
  group_unsubscribe: "unsubscribed",
};

/**
 * sg_message_id(`<X-Message-Id>.filter…` の形)から送信時の X-Message-Id を取り出す。
 */
function toProviderMessageId(sgMessageId: unknown): string | null {
  if (typeof sgMessageId !== "string" || sgMessageId.length === 0) return null;
  const head = sgMessageId.split(".")[0];
  return head.length > 0 ? head : null;
}

/** SendGrid が事件に付ける標準の欄(これ以外の文字列の欄 = 送る時の custom_args) */
const SENDGRID_STANDARD_FIELDS = new Set([
  "email",
  "timestamp",
  "event",
  "sg_event_id",
  "sg_message_id",
  "smtp-id",
  "category",
  "reason",
  "status",
  "response",
  "attempt",
  "type",
  "bounce_classification",
  "useragent",
  "ip",
  "url",
  "url_offset",
  "asm_group_id",
  "tls",
  "cert_err",
  "marketing_campaign_id",
  "marketing_campaign_name",
  "sg_machine_open",
  "sg_content_type",
  "pool",
]);

function sendGridCustomArgs(event: SendGridWebhookEvent): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!SENDGRID_STANDARD_FIELDS.has(key) && typeof value === "string") result[key] = value;
  }
  return result;
}

/**
 * 検証済みの SendGrid の事件を正規化する(配列の 1 件 = 事件 1 件)。sg_event_id の無い事件は飛ばす。
 */
export function normalizeSendGridWebhook(events: SendGridWebhookEvent[]): MailWebhookEvent[] {
  const normalized: MailWebhookEvent[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || typeof event.sg_event_id !== "string") continue;
    const type = SENDGRID_TYPE_MAP[event.event] ?? "other";
    normalized.push({
      provider: "sendgrid",
      providerMessageId: toProviderMessageId(event.sg_message_id),
      providerEventId: event.sg_event_id,
      type,
      address: typeof event.email === "string" ? event.email : null,
      occurredAt: new Date(typeof event.timestamp === "number" ? event.timestamp * 1000 : 0),
      raw: event,
      // bounce の type が blocked(受け手の一時の拒否)なら soft、それ以外の bounce は hard
      ...(type === "bounced" ? { bounce: event.type === "blocked" ? ("soft" as const) : ("hard" as const) } : {}),
      tags: sendGridCustomArgs(event),
    });
  }
  return normalized;
}
