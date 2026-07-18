// src/lib/dbAgent/index.ts
//
// クライアント安全なエクスポートのみをまとめるバレル。
// サーバー専用モジュールは直接 import すること:
//   - @/lib/dbAgent/service     (runDbAgent, isDbAgentEnabled)
//   - @/lib/dbAgent/readonlyDb  (getReadonlyDb)

export {
  DB_AGENT_AUDIT_ACTIONS,
  DB_AGENT_AUDIT_TARGET,
  type DbAgentAuditRecorder,
} from "./audit";

export {
  streamDbAgentChat,
  type StreamDbAgentChatOptions,
} from "./services/client/dbAgentClient";
