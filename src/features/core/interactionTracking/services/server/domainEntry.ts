// src/features/core/interactionTracking/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // 汎用インタラクション計測。書き込み主経路は公開 ingest (POST /api/interactions) +
  // interactionService.record（サーバ内部）。汎用 API は admin のイベント明細
  // 調査・閲覧のみに限定（fail-closed）。汎用 CRUD での直接挿入はカウンタを加算しない。
  interactionEvent: {
    service: () => import("./interactionService").then((m) => m.interactionService),
    table: "interaction_events",
    idColumn: "id",
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
  },
} satisfies DomainEntries;
