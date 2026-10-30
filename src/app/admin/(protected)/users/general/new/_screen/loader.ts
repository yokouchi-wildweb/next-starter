// src/app/admin/(protected)/users/general/new/_screen/loader.ts
// /admin/users/general/new の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 admin/(protected)/users(admin ロール) の createLoader で access だけを評価する。サーバー側の取得は無い
// (データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/admin/(protected)/users/guard";

export const loadAdminGeneralUserCreateScreen = createLoader({
  access: { roles: ["admin"] },
  load: async (): Promise<void> => {},
});
