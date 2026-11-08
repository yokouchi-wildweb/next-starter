// src/features/sample/services/server/domainEntry.ts
// pnpm generate domain が domain.json から生成する。手で直すときは domain.json の generate を false にする（そのドメインは生成しなくなる）。
// 登録表 src/registry/serviceRegistry.ts はこのファイルから pnpm generate registry が作る（pnpm generate domain の最後に自動で走る）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { ADMIN_RULE, PUBLIC_READ } from "@/lib/domain/accessPresets";

export const domainEntries = {
  sample: {
    service: () => import("./sampleService").then((m) => m.sampleService),
    table: "samples",
    idColumn: "id",
    access: {
      ...PUBLIC_READ,
      operations: {
        update: "authenticated",
        reorder: "authenticated",
        truncateAll: ADMIN_RULE,
        export: ADMIN_RULE,
        import: ADMIN_RULE,
      },
    },
  },
} satisfies DomainEntries;
