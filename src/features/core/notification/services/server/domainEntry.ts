// src/features/core/notification/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は pnpm generate domain の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm generate registry が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  notification: {
    service: () => import("./notificationService").then((m) => m.notificationService),
    table: "notifications",
    idColumn: "id",
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
    // 前提の機能(門番の依存の検査): お知らせの行はテンプレートを外部キーで参照する(notifications → notification_templates、D56)
    requires: ["notificationTemplate"],
  },
} satisfies DomainEntries;
