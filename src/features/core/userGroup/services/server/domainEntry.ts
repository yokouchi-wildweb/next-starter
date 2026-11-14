// src/features/core/userGroup/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は pnpm generate domain の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm generate registry が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/lib/domain/accessPresets";

export const domainEntries = {
  // ユーザーグループ（D103）。汎用 API には出さない（管理画面と API は専用の口 /api/admin/user-groups、次の指令）。門 userGroups が閉ならドメインごと閉じる
  userGroup: {
    service: () => import("./userGroupService").then((m) => m.userGroupService),
    table: "user_groups",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
