// src/lib/line/webhook.ts

import { createHmac } from "crypto";

import { getLineMessagingConfig } from "./config";
import type { LineWebhookBody, LineWebhookEvent } from "./types";

/**
 * LINE Webhook の署名を検証する。
 * リクエストボディの HMAC-SHA256 ダイジェストと x-line-signature ヘッダーを比較する。
 *
 * @param body - リクエストボディ（生の文字列）
 * @param signature - x-line-signature ヘッダーの値
 * @returns 署名が有効なら true
 */
export function verifySignature(body: string, signature: string): boolean {
  const { channelSecret } = getLineMessagingConfig();
  const digest = createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return digest === signature;
}

/**
 * リクエストから署名検証とボディのパースを行うヘルパー。
 * APIルートハンドラ内で使用する。
 *
 * @param request - Webhook リクエスト
 * @returns パース済みの Webhook ボディ
 * @throws 署名が無効な場合
 */
export async function parseWebhookRequest(
  request: Request,
): Promise<LineWebhookBody> {
  const signature = request.headers.get("x-line-signature");
  if (!signature) {
    throw new Error("x-line-signature ヘッダーがありません");
  }

  const body = await request.text();

  if (!verifySignature(body, signature)) {
    throw new Error("Webhook の署名検証に失敗しました");
  }

  return JSON.parse(body) as LineWebhookBody;
}

/**
 * イベント配列から指定タイプのイベントだけをフィルタするヘルパー。
 */
export function filterEvents<T extends LineWebhookEvent>(
  events: LineWebhookEvent[],
  type: T["type"],
): T[] {
  return events.filter((e) => e.type === type) as T[];
}
