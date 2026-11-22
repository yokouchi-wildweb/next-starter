// src/app/admin/(protected)/layout.tsx
//
// 方針(管理者カテゴリ・初期セットアップの誘導)は隣の guard.ts。

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { clientGateState } from "@/featureGate";
import { AdminCommandGateBridge } from "@/domains/core/adminCommand";
import { GateProvider } from "@/featureGate/client";

import { AdminProtectedLayout } from "./_layout/AdminProtectedLayout";
import { guard } from "./guard";

// 検索エンジンに載せない(robots noindex・nofollow、配下の全ページが継承する)。守られた範囲は、cacheComponents では
// 未ログインでも 307 ではなく本文の中の転送で 200 になりうる(中身は出ない)ので、その応答を索引させない
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  // 門番の管理の枠: 守りの後で /admin の下の閉じた住所を足した値で包み直す(公開ページの HTML に管理の住所を出さない)
  return (
    <GateProvider state={clientGateState("admin")}>
      {/* 管理のコマンドパレットの移動の候補もこの枠の値で絞る(L2.4) */}
      <AdminCommandGateBridge />
      <AdminProtectedLayout>{children}</AdminProtectedLayout>
    </GateProvider>
  );
}
