// src/app/admin/insane/layout.tsx
//
// 方針(admin ロール・初期セットアップの誘導)は隣の guard.ts。

import type { ReactNode } from "react";

import { clientGateState } from "@/featureGate";
import { GateProvider } from "@/featureGate/client";

import { InsaneProtectedLayout } from "./_layout";
import { guard } from "./guard";

export default async function InsaneLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  // 門番の管理の枠: 守りの後で /admin の下の閉じた住所を足した値で包み直す(公開ページの HTML に管理の住所を出さない)
  return (
    <GateProvider state={clientGateState("admin")}>
      <InsaneProtectedLayout>{children}</InsaneProtectedLayout>
    </GateProvider>
  );
}
