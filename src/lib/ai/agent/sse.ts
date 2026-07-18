// src/lib/ai/agent/sse.ts
//
// AgentEvent の AsyncGenerator を SSE (Server-Sent Events) レスポンスへ変換する
// サーバー側ヘルパー。API ルートハンドラから利用する。
//
// ワイヤ形式: 各イベントを `data: <JSON>\n\n` で送出する (event フィールドは
// 使わず、JSON 内の type で判別する。クライアント側は sseClient.ts を使う)。

import "server-only";

import { NextResponse } from "next/server";

import type { AgentEvent } from "./types";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Nginx 等のリバースプロキシによるバッファリングを無効化
  "X-Accel-Buffering": "no",
} as const;

/**
 * AgentEvent ジェネレータを SSE ストリーミングレスポンスへ変換する。
 *
 * - クライアント切断時は abortController.abort() を呼び、ジェネレータへ伝播する
 *   (runAgent は signal abort を検知して静かに終了する)
 * - ジェネレータ内で throw された場合は agent.error を送出して終了する
 */
export function createAgentSSEResponse(
  generator: AsyncGenerator<AgentEvent, void, undefined>,
  options?: { abortController?: AbortController },
): NextResponse {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of generator) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        }
      } catch (error) {
        console.error("[ai/agent] SSE stream failed:", error);
        const fallback: AgentEvent = {
          v: 1,
          type: "agent.error",
          message: "ストリーミング中にエラーが発生しました。",
        };
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(fallback)}\n\n`),
          );
        } catch {
          // すでに閉じている場合は無視
        }
      } finally {
        try {
          controller.close();
        } catch {
          // すでに閉じている場合は無視
        }
      }
    },
    cancel() {
      // クライアント切断 → エージェント実行を中断する
      options?.abortController?.abort();
      // ジェネレータの後始末 (finally 実行)
      void generator.return(undefined);
    },
  });

  return new NextResponse(stream, { headers: SSE_HEADERS });
}
