// src/features/core/bankTransferReview/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // 銀行振込の確認。操作は専用ルート（/api/admin/bank-transfer-reviews）だけ。登録表に載せるのはサーバー内部でドメイン名から表を引くため。
  bankTransferReview: {
    service: () => import("./bankTransferReviewService").then((m) => m.bankTransferReviewService),
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
