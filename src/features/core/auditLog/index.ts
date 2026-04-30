// src/features/core/auditLog/index.ts
//
// 汎用監査ログドメインの公開エントリーポイント (client-safe)。
//
// このバレルからは server-only な値 (auditLogger / pruneExpiredAuditLogs 等)
// は export しない。AuditTimeline 等の Client Component から import された際に
// `node:async_hooks` / `postgres` の依存がクライアントバンドルへ流入することを
// 防ぐため。
//
// server コードから recorder を使う場合は専用パスを利用する:
//   import { auditLogger } from "@/features/core/auditLog/services/server";
//
// client コード / Server Component の表示系はこの index から import:
//   import { AuditTimeline, auditLogClient } from "@/features/core/auditLog";

export type {
  AuditLog,
  AuditLogFailed,
  AuditLogCreateInput,
  AuditLogFailedCreateInput,
} from "./entities";

export {
  AUDIT_ACTOR_TYPES,
  type AuditActorType,
  ACTOR_TYPE_LABELS,
  DEFAULT_RETENTION_DAYS,
  AUDIT_MODE_DISABLED,
} from "./constants";

export {
  formatActionLabel,
  formatActorTypeLabel,
  formatAuditDate,
  registerActionLabels,
} from "./presenters";

export { AuditTimeline } from "./components/common/AuditTimeline";

export { auditLogClient } from "./services/client/auditLogClient";
