// src/app/admin/(protected)/layout.tsx
//
// 方針(管理者カテゴリ・初期セットアップの誘導)は隣の guard.ts。

import type { ReactNode } from "react";

import { clientGateState } from "@/featureGate";
import { AdminCommandGateBridge } from "@/features/core/adminCommand";
import { GateProvider } from "@/featureGate/client";

import { AdminProtectedLayout } from "./_layout/AdminProtectedLayout";
import { guard } from "./guard";

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
