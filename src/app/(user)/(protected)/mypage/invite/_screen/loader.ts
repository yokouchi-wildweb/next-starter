// src/app/(user)/(protected)/mypage/invite/_screen/loader.ts
// /mypage/invite(招待コード)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 遷移制御だけの loader(Promise<void>)。紹介機能(APP_FEATURES.marketing.referral.enabled)が無効なら /mypage へ redirect。
// サーバー側の取得は無い(招待コードはセクションコンテナが hook で取得する)。未ログインは layout の authGuard が弾く。

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";

export const loadMyPageInviteScreen = cache(async (): Promise<void> => {
  if (!APP_FEATURES.marketing.referral.enabled) {
    redirect("/mypage");
  }
});
