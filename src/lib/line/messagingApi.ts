// src/lib/line/messagingApi.ts

import { getLineMessagingConfig, LINE_API_BASE } from "./config";
import type { LineMessage, LineTextMessage } from "./types";

/**
 * Messaging API の共通リクエスト送信
 */
async function sendRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const { channelAccessToken } = getLineMessagingConfig();

  const response = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LINE Messaging API エラー: ${response.status} ${errorBody}`);
  }
}

/**
 * テキストメッセージオブジェクトを生成するヘルパー
 */
export function textMessage(text: string): LineTextMessage {
  return { type: "text", text };
}

/**
 * Push メッセージを送信する（サーバー→ユーザー）。
 * line_user_id が必要。
 *
 * @param to - LINE userId
 * @param messages - 送信するメッセージ（最大5件）
 */
export async function pushMessage(
  to: string,
  messages: LineMessage[],
): Promise<void> {
  await sendRequest("/v2/bot/message/push", { to, messages });
}

/**
 * Reply メッセージを送信する（Webhook イベントへの返信）。
 *
 * @param replyToken - Webhook イベントの replyToken
 * @param messages - 送信するメッセージ（最大5件）
 */
export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
): Promise<void> {
  await sendRequest("/v2/bot/message/reply", { replyToken, messages });
}

/**
 * マルチキャスト送信（複数ユーザーへの一斉送信）。
 *
 * @param to - LINE userId の配列（最大500件）
 * @param messages - 送信するメッセージ（最大5件）
 */
export async function multicast(
  to: string[],
  messages: LineMessage[],
): Promise<void> {
  await sendRequest("/v2/bot/message/multicast", { to, messages });
}

/**
 * ブロードキャスト送信（全友だちへの一斉送信）。
 *
 * @param messages - 送信するメッセージ（最大5件）
 */
export async function broadcast(
  messages: LineMessage[],
): Promise<void> {
  await sendRequest("/v2/bot/message/broadcast", { messages });
}
