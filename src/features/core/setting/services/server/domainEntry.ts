// src/features/core/setting/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  setting: {
    service: () => import("./settingService").then((m) => m.settingService),
    table: "settings",
    idColumn: "id",
    // 値の書き手は保存処理だけ: update 以外の書き込みは閉じる
    access: {
      ...ADMIN_ONLY,
      operations: {
        create: "none",
        remove: "none",
        upsert: "none",
        duplicate: "none",
        restore: "none",
        hardDelete: "none",
        reorder: "none",
        bulkUpsert: "none",
        bulkUpdate: "none",
        bulkUpdateByIds: "none",
        bulkDeleteByIds: "none",
        bulkDeleteByQuery: "none",
        replaceByQuery: "none",
        truncateAll: "none",
        import: "none",
        export: ADMIN_DATA_OPERATIONS.export,
      },
    },
  },
} satisfies DomainEntries;
