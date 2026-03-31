// src/lib/line/messagingApi.ts

import { getLineMessagingConfig, LINE_API_BASE } from "./config";
import { LINE_MULTICAST_MAX_RECIPIENTS } from "./constants";
import type { LineMessage, LineSendMessageResponse, LineTextMessage } from "./types";

/**
 * Messaging API の共通リクエスト送信。
 * レスポンスボディを型付きで返す。
 */
async function sendRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<LineSendMessageResponse> {
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

  // 200 でボディが空の場合（broadcast 等）は空オブジェクトを返す
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text) as LineSendMessageResponse;
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
): Promise<LineSendMessageResponse> {
  return sendRequest("/v2/bot/message/push", { to, messages });
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
): Promise<LineSendMessageResponse> {
  return sendRequest("/v2/bot/message/reply", { replyToken, messages });
}

/**
 * マルチキャスト送信（複数ユーザーへの一斉送信）。
 * 500件を超える場合は自動的にバッチ分割して順次送信する。
 *
 * @param to - LINE userId の配列（件数制限なし、内部で500件ごとに分割）
 * @param messages - 送信するメッセージ（最大5件）
 */
export async function multicast(
  to: string[],
  messages: LineMessage[],
): Promise<LineSendMessageResponse[]> {
  const results: LineSendMessageResponse[] = [];

  for (let i = 0; i < to.length; i += LINE_MULTICAST_MAX_RECIPIENTS) {
    const chunk = to.slice(i, i + LINE_MULTICAST_MAX_RECIPIENTS);
    const result = await sendRequest("/v2/bot/message/multicast", { to: chunk, messages });
    results.push(result);
  }

  return results;
}

/**
 * ブロードキャスト送信（全友だちへの一斉送信）。
 *
 * @param messages - 送信するメッセージ（最大5件）
 */
export async function broadcast(
  messages: LineMessage[],
): Promise<LineSendMessageResponse> {
  return sendRequest("/v2/bot/message/broadcast", { messages });
}
