// src/features/core/taskRun/services/server/domainEntry.ts
// core ドメインの登録（手書き。core の domain.json は pnpm generate domain の対象外）。登録表 src/registry/serviceRegistry.ts は
// このファイルから pnpm generate registry が作る。fork が access を変えるときは隣に domainEntry.override.ts を置く（このファイルは編集しない）。
// access = 汎用 API（/api/<domain>/**）と管理データ操作（truncateAll / export / import）の認可。詳細: src/lib/domain/README.md

import type { DomainEntries } from "@/lib/domain/types";
import { INTERNAL_ONLY } from "@/lib/domain/accessPresets";

export const domainEntries = {
  // pnpm task の実行の記録。書き手はタスクのランナーだけで、HTTP・管理画面には出さない。登録表に載せるのはサーバー内部でドメイン名から表を引くため。
  taskRun: {
    service: () => import("./drizzleBase").then((m) => m.taskRunBase),
    table: "task_runs",
    idColumn: "id",
    access: INTERNAL_ONLY,
  },
} satisfies DomainEntries;
