// src/lib/audit/index.ts
//
// 監査ログ基盤の純粋ロジック層。
// エンティティと recorder 実装は features/core/auditLog 側に存在する（lib→features 違反を回避）。
// ドメイン側は通常 `@/features/core/auditLog` から `auditLogger` を import すること。

export {
  runWithAuditContext,
  getAuditContext,
  requireAuditContext,
  runAsSystem,
} from "./context";

export {
  AUDIT_ACTOR_TYPES,
  type AuditActorType,
  type AuditContext,
  type AuditRecordInput,
  type AuditLogPayload,
} from "./types";

export { computeAuditDiff, type AuditDiff } from "./diff";

export { isDenylistedField, stripDenylisted } from "./denylist";

export {
  truncateLargeValues,
  validateActionName,
  validateTargetId,
} from "./validation";
