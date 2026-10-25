// src/features/core/deviceFingerprint/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_DATA_OPERATIONS, ADMIN_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // デバイスフィンガープリント。書き込み主経路は POST /api/me/fingerprint (本人 ingest) +
  // recordDeviceFingerprint (サーバ内部)。汎用 API は admin の閲覧・調査のみに限定 (fail-closed)。
  // 類似照合は /api/admin/device-fingerprint/similar・compare を使う。
  deviceFingerprint: {
    service: () => import("./index").then((m) => m.deviceFingerprintService),
    access: { ...ADMIN_ONLY, operations: ADMIN_DATA_OPERATIONS },
  },
} satisfies DomainEntries;
