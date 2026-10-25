// src/features/core/userXProfile/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // X 連携プロフィール。本人・管理の操作は専用ルートだけ（汎用 API・全件削除・データ移行には出さない）。
  userXProfile: {
    service: () => import("./userXProfileService").then((m) => m.userXProfileService),
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
