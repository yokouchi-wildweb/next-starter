// src/lib/ai/index.ts
//
// クライアント安全なエクスポートのみをまとめる入口(@/lib/ai)。
// サーバー専用(getAnthropicClient・runAgent・createAgentSSEResponse)は入口 @/lib/ai/server(server.ts)。

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

export { aiConfig } from "./config";
export type { AiConfig, AiOverride } from "./config";
