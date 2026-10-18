// src/app/(user)/(protected)/mypage/pause/_screen/loader.ts
// /mypage/pause(休会)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 遷移制御だけの loader(Promise<void>)。休会機能(APP_FEATURES.user.pauseEnabled)が無効なら notFound。
// サーバー側の取得は無い。未ログインは layout の authGuard が弾く。

import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";

export const loadMyPagePauseScreen = cache(async (): Promise<void> => {
  if (!APP_FEATURES.user.pauseEnabled) {
    notFound();
  }
});
