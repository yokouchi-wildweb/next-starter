// src/features/core/chatRoom/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // Firestore 版（truncateAll / getTableName を持たないので全件削除の一覧には出ない。operations の truncateAll は形を揃えるための明示）。
  chatRoom: {
    service: () => import("./chatRoomService").then((m) => m.chatRoomService),
    // Firestore 版は表を持たない
    table: null,
    idColumn: null,
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
  },
} satisfies DomainEntries;
