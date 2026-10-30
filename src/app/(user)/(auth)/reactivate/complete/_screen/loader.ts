// src/app/(user)/(auth)/reactivate/complete/_screen/loader.ts
// /reactivate/complete の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader で access だけを評価する(public。復帰直後の案内。status が変わる途中でも表示する)。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/guard";

export const loadReactivateCompleteScreen = createLoader({
  access: "public",
  load: async (): Promise<void> => {},
});
