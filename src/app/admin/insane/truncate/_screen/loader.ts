// src/app/admin/insane/truncate/_screen/loader.ts
// /admin/insane/truncate の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 admin/insane(admin ロール) の createLoader で access だけを評価する。サーバー側の取得は無い
// (データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/admin/insane/guard";

export const loadInsaneTruncateScreen = createLoader({
  access: { roles: ["admin"] },
  load: async (): Promise<void> => {},
});
