// src/lib/ai/agent/sseClient.ts
//
// SSE レスポンス (sse.ts が送出する `data: <JSON>\n\n` 形式) をパースして
// AgentEvent を逐次 yield するクライアント側ヘルパー。
// ClientService (fetch + ReadableStream) から利用する。
//
// 注意: このファイルはクライアントからも import されるため server-only を付けない。

import {
  AGENT_PROTOCOL_VERSION,
  type AgentEvent,
} from "./types";

/**
 * fetch の Response (SSE) から AgentEvent を逐次 yield する。
 *
 * - 未知のバージョン / パース不能な行は無視する (前方互換)
 * - response.ok チェックは呼び出し側 (ClientService) の責務
 */
export async function* parseAgentEventStream(
  response: Response,
): AsyncGenerator<AgentEvent, void, undefined> {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE のイベント区切りは空行 (\n\n)
      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const event = parseSSEEvent(rawEvent);
        if (event) {
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * 1イベント分のテキスト (`data: ...` 行の集合) を AgentEvent にパースする。
 * 不正な形式・未知バージョンは null (呼び出し側で無視される)。
 */
function parseSSEEvent(rawEvent: string): AgentEvent | null {
  const dataLines = rawEvent
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) return null;

  try {
    const parsed: unknown = JSON.parse(dataLines.join("\n"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "type" in parsed &&
      (parsed as { v: unknown }).v === AGENT_PROTOCOL_VERSION
    ) {
      return parsed as AgentEvent;
    }
    return null;
  } catch {
    return null;
  }
}
