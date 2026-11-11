// src/lib/line/messagingApi.ts

import { LINE_API_BASE } from "./endpoints";
import { getLineMessagingConfig } from "./env";
import { LINE_MULTICAST_MAX_RECIPIENTS } from "./constants";
import { LineApiError } from "./errors";
import type { LineMessage, LineSendMessageResponse, LineTextMessage } from "./types";

/** push の追加の指定 */
export type PushMessageOptions = {
  /**
   * X-Line-Retry-Key(UUID の形。lineRetryKey(呼び手の鍵) で作る)。送り直しで同じ鍵を付けると、
   * LINE が受付済みの要求は 409 で返し二重に送らない(この lib は 409 を成功として返す)。LINE が鍵を覚えるのは 24 時間
   */
  retryKey?: string;
};

function parseResponseBody(text: string): LineSendMessageResponse {
  if (!text) return {};
  try {
    return JSON.parse(text) as LineSendMessageResponse;
  } catch {
    return {};
  }
}

/**
 * Messaging API の共通リクエスト送信。
 * レスポンスボディを型付きで返す。
 * @throws LineApiError 応答が 2xx でない(status, retryable, body)・応答なし(status null, retryable true)
 */
async function sendRequest(
  path: string,
  body: Record<string, unknown>,
  options: { retryKey?: string } = {},
): Promise<LineSendMessageResponse> {
  const { channelAccessToken } = getLineMessagingConfig();

  let response: Response;
  try {
    response = await fetch(`${LINE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
        ...(options.retryKey ? { "X-Line-Retry-Key": options.retryKey } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // 応答が無い(接続の失敗・中断)。再試行の鍵があれば送り直しても二重にならない
    throw new LineApiError({ status: null, body: null, cause: error });
  }

  if (response.status === 409 && options.retryKey) {
    // 同じ再試行の鍵の要求を LINE が受付済み = 前の送信が届いている。本文は前の送信の sentMessages
    return parseResponseBody(await response.text());
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new LineApiError({ status: response.status, body: errorBody });
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
 * @param options - retryKey = X-Line-Retry-Key(受付済みの 409 は成功として返す)
 */
export async function pushMessage(
  to: string,
  messages: LineMessage[],
  options: PushMessageOptions = {},
): Promise<LineSendMessageResponse> {
  return sendRequest("/v2/bot/message/push", { to, messages }, { retryKey: options.retryKey });
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
