// src/app/(user)/(protected)/mypage/account/notifications/_screen/loader.ts
// /mypage/account/notifications(通知の設定 = 連絡の好み)の loader。上流所有。下流は編集せず、既定 Screen も差し替え Screen もこれを呼ぶ。
// 規則と差し替え手順: src/lib/screens/README.md §4
//
// 仕様: 範囲 (user)/(protected) の createLoader(access authenticated。未ログインは /login)。遷移制御だけ(Promise<void>)。
// 住所は門の機能 messagingPreferences(既定 閉、pageMypage に依存)が proxy で閉じる。ここでも閉なら notFound(proxy を通らない描画の備え)。
// サーバー側の取得は無い(表はセクションコンテナ MessagePreferences が hook で取る)

import "server-only";

import { notFound } from "next/navigation";

import { gate } from "@/featureGate";
import { createLoader } from "@/app/(user)/(protected)/guard";

export const loadMyPageAccountNotificationsScreen = createLoader({
  access: "authenticated",
  load: async (): Promise<void> => {
    if (!gate.enabled("messagingPreferences")) {
      notFound();
    }
  },
});
