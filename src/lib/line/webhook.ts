// src/lib/line/webhook.ts

import { createHmac, timingSafeEqual } from "crypto";

import { getLineMessagingConfig } from "./env";
import type { LineWebhookBody, LineWebhookEvent } from "./types";

/**
 * LINE Webhook の署名を検証する（タイミングセーフ比較）。
 * リクエストボディの HMAC-SHA256 ダイジェスト（base64）と x-line-signature ヘッダーを比較する。
 * base64 の文字列どうしを比べる（デコードし直すと不正な文字が黙って捨てられ、別の文字列が一致しうるため）。
 * 長さが違う・空の署名は例外を出さずに false。
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
  const expected = Buffer.from(digest);
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
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
