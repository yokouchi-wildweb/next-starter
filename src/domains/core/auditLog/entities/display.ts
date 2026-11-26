// 生成物・編集不可: pnpm generate registry が src/domains/core/auditLog/entities/auditLog/entity.json から生成する
// client に出す表示用の写し(秘密・内部の項目は持たない)。詳細: src/lib/domain/README.md

import type { DomainDisplay } from "@/lib/domain";

export const domainDisplay: DomainDisplay = {
  "singular": "audit_log",
  "plural": "audit_logs",
  "label": "監査ログ",
  "fields": [],
  "relations": [],
  "searchFields": [],
  "useCreatedAt": false,
  "useUpdatedAt": false,
  "useSoftDelete": false
};
