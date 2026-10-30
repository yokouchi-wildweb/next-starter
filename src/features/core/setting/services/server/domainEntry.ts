// src/features/core/setting/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  setting: {
    service: () => import("./settingService").then((m) => m.settingService),
    table: "settings",
    idColumn: "id",
    // 読み書きは主体を渡せる専用の窓口(/api/setting/admin・/public)だけ。汎用 API は閉じる
    access: { ...INTERNAL_ONLY, operations: { export: ADMIN_DATA_OPERATIONS.export } },
  },
} satisfies DomainEntries;
