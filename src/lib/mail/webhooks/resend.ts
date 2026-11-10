// src/lib/mail/webhooks/resend.ts
//
// Resend の webhook(Svix の署名)の検証と正規化。
// - 署名 = HMAC-SHA256(秘密, `${svix-id}.${svix-timestamp}.${生の本文}`) の base64。svix-signature は
//   空白区切りの `v1,<署名>` の並び(秘密の切り替え中は複数)で、どれか 1 つと合えば通す
// - 秘密は Resend の webhook の設定に出る `whsec_<base64>`
// - resend SDK の webhooks.verify は Resend の client(API キー)を要するので使わず、node:crypto で検証する

import { createHmac, timingSafeEqual } from "node:crypto";

import { rawBodyToString, readWebhookHeader } from "./shared";
import {
  MailWebhookVerifyError,
  type MailWebhookEvent,
  type MailWebhookEventType,
  type WebhookHeaders,
  type WebhookRawBody,
} from "./types";

/** Resend の webhook の本文(メールの事件で使う所だけ) */
export type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data?: {
    email_id?: string;
    created_at?: string;
    to?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type VerifyResendWebhookParams = {
  rawBody: WebhookRawBody;
  headers: WebhookHeaders;
  /** webhook の秘密(whsec_ で始まる値) */
  secret: string;
  /** timestamp の許す差(秒、既定 300) */
  toleranceSec?: number;
  /** 今の時刻(テスト用) */
  now?: Date;
};

export type VerifiedResendWebhook = {
  /** svix-id(事件の id。再試行でも同じ) */
  svixId: string;
  payload: ResendWebhookPayload;
};

const DEFAULT_TOLERANCE_SEC = 300;

function decodeSecret(secret: string): Buffer {
  const body = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(body, "base64");
}

/**
 * Resend の webhook を検証し、解析した本文と svix-id を返す。
 * 失敗は MailWebhookVerifyError で投げる。
 */
export function verifyResendWebhook(params: VerifyResendWebhookParams): VerifiedResendWebhook {
  const { rawBody, headers, secret } = params;
  const toleranceSec = params.toleranceSec ?? DEFAULT_TOLERANCE_SEC;
  const now = params.now ?? new Date();

  const svixId = readWebhookHeader(headers, "svix-id");
  const svixTimestamp = readWebhookHeader(headers, "svix-timestamp");
  const svixSignature = readWebhookHeader(headers, "svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new MailWebhookVerifyError("resend", "missing_header", "svix のヘッダが欠けています");
  }

  const timestampSec = Number(svixTimestamp);
  if (!Number.isFinite(timestampSec)) {
    throw new MailWebhookVerifyError("resend", "bad_signature", "svix-timestamp が数値ではありません");
  }
  if (Math.abs(now.getTime() / 1000 - timestampSec) > toleranceSec) {
    throw new MailWebhookVerifyError("resend", "stale_timestamp", "svix-timestamp が許す範囲の外です");
  }

  const body = rawBodyToString(rawBody);
  const expected = createHmac("sha256", decodeSecret(secret))
    .update(`${svixId}.${svixTimestamp}.${body}`)
    .digest();

  const matched = svixSignature.split(" ").some((part) => {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matched) {
    throw new MailWebhookVerifyError("resend", "bad_signature", "svix-signature が合いません");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new MailWebhookVerifyError("resend", "bad_payload", "本文が JSON ではありません");
  }
  if (!payload || typeof payload !== "object" || typeof (payload as { type?: unknown }).type !== "string") {
    throw new MailWebhookVerifyError("resend", "bad_payload", "本文に type がありません");
  }
  return { svixId, payload: payload as ResendWebhookPayload };
}

const RESEND_TYPE_MAP: Record<string, MailWebhookEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "deferred",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "dropped",
  "email.suppressed": "dropped",
};

/**
 * 検証済みの Resend の事件を正規化する(1 本文 = 事件 1 件)。
 */
export function normalizeResendWebhook(verified: VerifiedResendWebhook): MailWebhookEvent[] {
  const { svixId, payload } = verified;
  const data = payload.data ?? {};
  const occurred = new Date(payload.created_at ?? data.created_at ?? "");
  const type = RESEND_TYPE_MAP[payload.type] ?? "other";
  return [
    {
      provider: "resend",
      providerMessageId: typeof data.email_id === "string" ? data.email_id : null,
      providerEventId: svixId,
      type,
      address: Array.isArray(data.to) && typeof data.to[0] === "string" ? data.to[0] : null,
      occurredAt: Number.isNaN(occurred.getTime()) ? new Date(0) : occurred,
      raw: payload,
      ...(type === "bounced" ? { bounce: resendBounceKind(data.bounce) } : {}),
      tags: resendTags(data.tags),
    },
  ];
}

/** Resend の bounce の種類: Permanent だけ hard(Transient・Undetermined・無しは soft) */
function resendBounceKind(bounce: unknown): "hard" | "soft" {
  const type = bounce && typeof bounce === "object" ? (bounce as { type?: unknown }).type : undefined;
  return typeof type === "string" && type.toLowerCase() === "permanent" ? "hard" : "soft";
}

/** Resend の tags(object か [{ name, value }])を名前 → 値に */
function resendTags(tags: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      const { name, value } = (tag ?? {}) as { name?: unknown; value?: unknown };
      if (typeof name === "string" && typeof value === "string") result[name] = value;
    }
  } else if (tags && typeof tags === "object") {
    for (const [name, value] of Object.entries(tags)) if (typeof value === "string") result[name] = value;
  }
  return result;
}
