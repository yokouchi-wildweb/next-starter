// src/app/(user)/(protected)/mypage/_screen/loader.ts
// /mypage(マイページトップ) の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader で access だけを評価する(authenticated。未ログインは /login)。
// サーバー側の取得は無い(データの無い Screen にも access の loader を置く)。

import "server-only";

import { createLoader } from "@/app/(user)/(protected)/guard";

export const loadMyPageScreen = createLoader({
  access: "authenticated",
  load: async (): Promise<void> => {},
});
