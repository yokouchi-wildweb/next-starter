// src/features/core/auditLog/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // 監査ログ（コンプライアンス記録）。汎用 API・全件削除・データ移行には出さない（INTERNAL_ONLY）。
  // 横断検索は専用ルート（/api/admin/audit-logs）から searchByTarget / searchBySubjectUser を使う。
  // auditLogFailed = 記録に失敗した監査ログの退避表（復旧は cron audit-log-recover-dead-letter）。
  auditLog: {
    service: () => import("./index").then((m) => m.auditLogService),
    table: "audit_logs",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
  auditLogFailed: {
    service: () => import("./drizzleBase").then((m) => m.auditLogFailedBase),
    table: "audit_logs_failed",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
