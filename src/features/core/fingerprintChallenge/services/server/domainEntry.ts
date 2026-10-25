// src/features/core/fingerprintChallenge/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // 回答チャレンジ。発行 / 状態遷移は /api/admin/fingerprint-challenges (専用アクション)、
  // 本人の回答は /api/me/fingerprint-challenges/[token]。汎用 API は admin の一覧・検索のみ。
  fingerprintChallenge: {
    service: () => import("./index").then((m) => m.fingerprintChallengeService),
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
  },
} satisfies DomainEntries;
