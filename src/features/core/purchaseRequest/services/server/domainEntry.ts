// src/features/core/purchaseRequest/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は pnpm generate domain の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm generate registry が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/lib/domain/accessPresets";

export const domainEntries = {
  // ユーザー所有データ。汎用 API は admin 限定（wallet と同じ）。
  purchaseRequest: {
    service: () => import("./purchaseRequestService").then((m) => m.purchaseRequestService),
    table: "purchase_requests",
    idColumn: "id",
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
    // 前提の機能(門番の依存の検査): 購入はウォレットへの加算と履歴の行が主な働き(表の外部キー wallet_history_id も)
    requires: ["wallet", "walletHistory"],
  },
} satisfies DomainEntries;
