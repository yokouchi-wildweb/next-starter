// src/features/core/userLoginEvent/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // ログインイベント。閲覧は専用ルート（/api/admin/user-hub/[id]/login-events）、記録は recordLoginEvent（サーバー内部）。
  userLoginEvent: {
    service: () => import("./index").then((m) => m.userLoginEventService),
    table: "user_login_events",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
