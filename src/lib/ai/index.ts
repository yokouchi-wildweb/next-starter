// src/lib/ai/index.ts
//
// クライアント安全なエクスポートのみをまとめるバレル。
// サーバー専用モジュールは直接 import すること:
//   - @/lib/ai/client         (getAnthropicClient)
//   - @/lib/ai/agent/runtime  (runAgent)
//   - @/lib/ai/agent/sse      (createAgentSSEResponse)

export {
  AGENT_PROTOCOL_VERSION,
  type AgentBlock,
  type AgentChartSeries,
  type AgentChatMessage,
  type AgentEvent,
  type AgentToolContext,
  type AgentToolDefinition,
  type AgentToolRunResult,
  type AgentUsage,
  type RunAgentOptions,
} from "./agent/types";

export {
  PRESENT_RESULT_TOOL_NAME,
  agentBlockSchema,
  parsePresentResultInput,
} from "./agent/blocks";

export { parseAgentEventStream } from "./agent/sseClient";
