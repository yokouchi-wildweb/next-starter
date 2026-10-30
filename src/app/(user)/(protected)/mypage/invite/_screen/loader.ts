// src/app/(user)/(protected)/mypage/invite/_screen/loader.ts
// /mypage/invite(招待コード)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。遷移制御だけ(Promise<void>)。
// 紹介機能(APP_FEATURES.marketing.referral.enabled)が無効なら /mypage へ redirect。
// サーバー側の取得は無い(招待コードはセクションコンテナが hook で取得する)。

import "server-only";

import { redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { createLoader } from "@/app/(user)/(protected)/guard";

export const loadMyPageInviteScreen = createLoader({
  access: "authenticated",
  load: async (): Promise<void> => {
    if (!APP_FEATURES.marketing.referral.enabled) {
      redirect("/mypage");
    }
  },
});
