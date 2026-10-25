// src/features/core/wallet/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // ユーザー所有データ。オーナーシップ強制の /api/me/ 専用ルートへ移行するまで汎用 API は admin 限定に維持する。
  wallet: {
    service: () => import("./walletService").then((m) => m.walletService),
    table: "wallets",
    idColumn: "id",
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
  },
} satisfies DomainEntries;
