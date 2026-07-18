// src/lib/dbAgent/tools/index.ts

import type { AgentToolDefinition } from "@/lib/ai";
import { dbAgentExtraTools } from "@/registry/dbAgentToolRegistry";

import type { DbAgentAuditRecorder } from "../audit";
import { describeTableTool } from "./describeTable";
import { listTablesTool } from "./listTables";
import { createRunQueryTool } from "./runQuery";

/**
 * DB調査エージェントのツール一式を組み立てる。
 * 組み込み (list_tables / describe_table / run_query) + downstream レジストリ登録分。
 *
 * @param recorder 監査レコーダ (API ルート側から auditLogger を注入する)
 */
export function buildDbAgentTools(
  recorder?: DbAgentAuditRecorder,
): AgentToolDefinition[] {
  return [
    listTablesTool,
    describeTableTool,
    createRunQueryTool(recorder),
    ...dbAgentExtraTools,
  ];
}
