// src/lib/audit/index.ts
//
// 監査ログ基盤の純粋ロジック層(client でも server でも読める: 型・actor の種類・diff・denylist・検証)。
// 監査コンテキスト(node の AsyncLocalStorage)は入口 ./server。
// エンティティと recorder 実装は features/core/auditLog 側に存在する（lib→features 違反を回避）。
// ドメイン側は通常 `@/features/core/auditLog` から `auditLogger` を import すること。

export {
  AUDIT_ACTOR_TYPES,
  type AuditActorType,
  type AuditContext,
  type AuditRecordInput,
  type AuditRecordDiffInput,
  type AuditRecorder,
  type AuditLogPayload,
} from "./types";

export { computeAuditDiff, type AuditDiff } from "./diff";

export { isDenylistedField, stripDenylisted } from "./denylist";

export {
  truncateLargeValues,
  validateActionName,
  validateTargetId,
} from "./validation";
