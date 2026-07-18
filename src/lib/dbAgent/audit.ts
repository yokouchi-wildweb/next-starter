// src/lib/dbAgent/audit.ts
//
// dbAgent の監査記録インターフェース。
//
// lib → features の依存を作らないため、実体 (auditLogger) は API ルート側から
// 注入する (createCrudService の audit.recorder 注入と同じパターン)。
// auditLogger は構造的にこの型を満たす。

/** 監査アクション名 (ESLint 命名規約 <domain>.<entity>.<verb_past> に準拠) */
export const DB_AGENT_AUDIT_ACTIONS = {
  /** run_query による SQL 実行 (実行のたびに記録) */
  queryExecuted: "admin.db_agent.query_executed",
  /** 1ターンの完了 (トークン使用量の記録) */
  turnCompleted: "admin.db_agent.turn_completed",
} as const;

/** 監査ログの target (シングルトン運用: setting の "global" と同様) */
export const DB_AGENT_AUDIT_TARGET = {
  targetType: "db_agent",
  targetId: "global",
} as const;

/**
 * 注入する監査レコーダの契約 (auditLogger.record のサブセット)。
 * メソッド構文で宣言し、auditLogger を構造的に代入可能にしている。
 */
export type DbAgentAuditRecorder = {
  record(input: {
    targetType: string;
    targetId: string;
    action: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
};
