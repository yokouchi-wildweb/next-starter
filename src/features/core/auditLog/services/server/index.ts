// src/features/core/auditLog/services/server/index.ts

export { auditLogger, type AuditLogger } from "./auditLogService";
export { auditLogBase, auditLogFailedBase } from "./drizzleBase";
export { searchByTarget, type SearchByTargetParams } from "./wrappers/searchByTarget";

import { auditLogBase } from "./drizzleBase";
import { searchByTarget } from "./wrappers/searchByTarget";

/**
 * 監査ログ参照系サービス。serviceRegistry に登録して `[domain]` 経由の API
 * から横断検索を可能にする (`POST /api/admin/audit-logs/search` 等)。
 *
 * 書き込みはこのサービスを経由しない（`auditLogger.record` を使う）。
 */
export const auditLogService = {
  ...auditLogBase,
  searchByTarget,
};
