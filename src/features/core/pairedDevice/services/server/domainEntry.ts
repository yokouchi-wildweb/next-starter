// src/features/core/pairedDevice/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は dc:generate の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm registry:generate が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  // 登録端末（kiosk 等）。操作は createDeviceRoute / 専用ルートだけ。登録表に載せるのはサーバー内部でドメイン名から表を引くため。
  // サービスのオブジェクトは無い（deviceService.ts は関数の集まり）ので createCrudService の戻り値 pairedDeviceBase を載せる。
  pairedDevice: {
    service: () => import("./drizzleBase").then((m) => m.pairedDeviceBase),
    table: "paired_devices",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
