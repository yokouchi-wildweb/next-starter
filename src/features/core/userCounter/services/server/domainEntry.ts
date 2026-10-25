// src/features/core/userCounter/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // 汎用 per-user カウンタ。書き込み主経路は counterService.bump（サーバ内部専用）。
  // 汎用 API は admin 閲覧・手動補正のみに限定（fail-closed）。ユーザ向け read は
  // 各ドメインが /api/me/<feature> を薄く生やして提供する（README 参照）。
  userCounter: {
    service: () => import("./counterService").then((m) => m.counterService),
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
  },
} satisfies DomainEntries;
