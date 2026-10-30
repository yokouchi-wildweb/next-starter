// src/app/(user)/(auth)/forgot-password/_screen/loader.ts
// /forgot-password の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 root(src/app/guard.ts)の createLoader で access だけを評価する(public。未ログインで使う再設定の流れ)。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/guard";

export const loadForgotPasswordScreen = createLoader({
  access: "public",
  load: async (): Promise<void> => {},
});
