// src/lib/dbAgent/index.ts
//
// 入口(@/lib/dbAgent)。クライアント安全な物(監査の定数・SSE クライアント・設定・拡張点の型)だけを出す。
// サーバー専用の物は入口 @/lib/dbAgent/server(server.ts)。

export {
  DB_AGENT_AUDIT_ACTIONS,
  DB_AGENT_AUDIT_TARGET,
  type DbAgentAuditRecorder,
} from "./audit";

export {
  streamDbAgentChat,
  type StreamDbAgentChatOptions,
} from "./services/client/dbAgentClient";

// 拡張点の型(src/wiring/dbAgent/extensionPoints.ts)
export type { DbAgentPromptFragment, DbAgentSystemSuffixProvider } from "./prompt";

// 設定
export { dbAgentConfig } from "./config";
export type { DbAgentConfig, DbAgentOverride } from "./config";
