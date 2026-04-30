// src/features/core/auditLog/index.ts
//
// 汎用監査ログドメインの公開エントリーポイント。
// 他ドメインの wrapper / service からはここから auditLogger を import すること。
//
// 例:
//   import { auditLogger } from "@/features/core/auditLog";
//   await auditLogger.record({
//     targetType: "user",
//     targetId: userId,
//     action: "user.email.changed",
//     before: { email: oldEmail },
//     after: { email: newEmail },
//     tx,
//   });

export { auditLogger, type AuditLogger } from "./services/server/auditLogService";

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
