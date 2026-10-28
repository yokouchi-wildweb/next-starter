// src/features/sampleImage/services/server/domainEntry.ts
// dc:generate が domain.json から生成する（generateFiles.registry）。手で直すときは generateFiles.registry を false にする。
// 登録表 src/registry/serviceRegistry.ts はこのファイルから pnpm registry:generate が作る（dc:generate の最後に自動で走る）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_RULE, INTERNAL_ONLY } from "@/config/app/domain-api-access.config";

export const domainEntries = {
  sampleImage: {
    service: () => import("./sampleImageService").then((m) => m.sampleImageService),
    table: "sample_images",
    idColumn: "id",
    access: {
      ...INTERNAL_ONLY,
      operations: {
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
} satisfies DomainEntries;
