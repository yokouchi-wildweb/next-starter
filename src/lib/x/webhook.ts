// src/lib/x/webhook.ts

import { createHmac, timingSafeEqual } from "crypto";

import { getXAppConfig } from "./config";
import type { XCrcChallengeResponse, XWebhookEvent } from "./types";

/**
 * X Webhook の署名を検証する（タイミングセーフ比較）。
 * リクエストボディの HMAC-SHA256 ダイジェストと署名ヘッダーを比較する。
 *
 * @param body - リクエストボディ（生の文字列）
 * @param signature - x-twitter-webhooks-signature ヘッダーの値（"sha256=..." 形式）
 * @param consumerSecret - アプリの Consumer Secret（省略時は環境変数から取得）
 * @returns 署名が有効なら true
 */
export function verifyXWebhookSignature(
  body: string,
  signature: string,
  consumerSecret?: string,
): boolean {
  const secret = consumerSecret ?? getXAppConfig().appSecret;

  const expectedDigest = createHmac("sha256", secret)
    .update(body)
    .digest("base64");

  const expected = `sha256=${expectedDigest}`;

  if (expected.length !== signature.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}

/**
 * Account Activity API の CRC チャレンジに応答する。
 * GET リクエストで crc_token パラメータが送られた際にこのレスポンスを返す。
 *
 * @param crcToken - クエリパラメータ crc_token の値
 * @param consumerSecret - アプリの Consumer Secret（省略時は環境変数から取得）
 * @returns CRC レスポンスオブジェクト
 */
export function handleCrcChallenge(
  crcToken: string,
  consumerSecret?: string,
): XCrcChallengeResponse {
  const secret = consumerSecret ?? getXAppConfig().appSecret;

  const responseToken = createHmac("sha256", secret)
    .update(crcToken)
    .digest("base64");

  return {
    response_token: `sha256=${responseToken}`,
  };
}

/**
 * Webhook リクエストの署名検証とボディのパースを行うヘルパー。
 * API Route Handler 内で使用する。
 *
 * @param request - Webhook リクエスト
 * @param consumerSecret - アプリの Consumer Secret（省略時は環境変数から取得）
 * @returns パース済みの Webhook イベント
 * @throws 署名が無効な場合
 */
export async function parseXWebhookRequest(
  request: Request,
  consumerSecret?: string,
): Promise<XWebhookEvent> {
  const signature = request.headers.get("x-twitter-webhooks-signature");
  if (!signature) {
    throw new Error("x-twitter-webhooks-signature ヘッダーがありません");
  }

  const body = await request.text();

  if (!verifyXWebhookSignature(body, signature, consumerSecret)) {
    throw new Error("Webhook の署名検証に失敗しました");
  }

  return JSON.parse(body) as XWebhookEvent;
}
