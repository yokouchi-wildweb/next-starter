// src/lib/dbAgent/services/client/dbAgentClient.ts
//
// DB調査エージェントの ClientService (ストリーミング)。
//
// CLAUDE.md の例外規約に基づき、ストリーミング ClientService に限り
// axios ではなく fetch + ReadableStream を使う (axios はブラウザで
// レスポンスストリーミングを扱えないため)。HTTP 呼び出しを ClientService に
// 集約する原則は維持している (Hook / Component から fetch を直接叩かないこと)。

import type { AgentChatMessage, AgentEvent } from "@/lib/ai";
import { parseAgentEventStream } from "@/lib/ai";
import { createHttpError, normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/admin/db-agent";

export type StreamDbAgentChatOptions = {
  /** 会話履歴 (最後は user メッセージ)。サーバーはステートレスで毎回全量送る */
  messages: AgentChatMessage[];
  /** 中断用シグナル (アンマウント時・停止ボタン等) */
  signal?: AbortSignal;
};

/**
 * DB調査エージェントに1ターン分の応答をリクエストし、AgentEvent を逐次 yield する。
 *
 * - HTTP エラー (401/403/503 等) は HttpError として throw する
 * - ストリーム自体のエラーは agent.error イベントとして届く (throw しない)
 */
export async function* streamDbAgentChat(
  options: StreamDbAgentChatOptions,
): AsyncGenerator<AgentEvent, void, undefined> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: options.messages }),
      signal: options.signal,
    });
  } catch (error) {
    // 中断はそのまま伝播させる (呼び出し側の制御フロー)
    if (options.signal?.aborted) throw error;
    throw normalizeHttpError(error, "AIアシスタントへの接続に失敗しました");
  }

  if (!response.ok) {
    let responseData: unknown = null;
    try {
      responseData = await response.json();
    } catch {
      // JSON でないエラーレスポンスは無視
    }
    const message =
      typeof responseData === "object" &&
      responseData !== null &&
      "message" in responseData &&
      typeof (responseData as { message: unknown }).message === "string"
        ? (responseData as { message: string }).message
        : "AIアシスタントへのリクエストに失敗しました";

    throw createHttpError({
      message,
      status: response.status,
      responseData,
    });
  }

  yield* parseAgentEventStream(response);
}
