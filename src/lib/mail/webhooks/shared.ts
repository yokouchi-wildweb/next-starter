// src/lib/mail/webhooks/shared.ts

import type { WebhookHeaders, WebhookRawBody } from "./types";

/** ヘッダを名前の大小を問わずに読む(複数値は先頭) */
export function readWebhookHeader(headers: WebhookHeaders, name: string): string | null {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name);
  }
  const record = headers as Record<string, string | string[] | undefined | null>;
  const lower = name.toLowerCase();
  const key = Object.keys(record).find((k) => k.toLowerCase() === lower);
  if (key === undefined) return null;
  const value = record[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function rawBodyToString(rawBody: WebhookRawBody): string {
  return typeof rawBody === "string" ? rawBody : Buffer.from(rawBody).toString("utf8");
}

export function rawBodyToBuffer(rawBody: WebhookRawBody): Buffer {
  return typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
}
