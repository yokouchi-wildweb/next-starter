// src/app/admin/(protected)/layout.tsx
//
// 方針(管理者カテゴリ・初期セットアップの誘導)は隣の guard.ts。

import type { ReactNode } from "react";

import { clientGateState } from "@/featureGate";
import { AdminCommandGateBridge } from "@/domains/core/adminCommand";
import { GateProvider } from "@/featureGate/client";

import { AdminProtectedLayout } from "./_layout/AdminProtectedLayout";
import { Guard, guardMetadata } from "./guard";
import AdminLoading from "./loading";

// 先に守りを通してから metadata を返す(断られた訪問者の応答に配下のページの題名を出さない。Next は根からページへ順に解き、
// 断りは redirect / notFound を投げて解決ごと止める)。許された時は robots noindex・nofollow を配下の全ページが継承する。
// 断られた応答(cacheComponents では 200 + 本文の中の転送)の索引避けは proxy の飾り admin/plugs/proxyDecorators/noindex.ts の
// X-Robots-Tag(/admin 以下の全部の応答)
export const generateMetadata = guardMetadata({ robots: { index: false, follow: false } });

// 守りは layout の頭で待たず、境界(Guard = Suspense + この範囲の loading)の内側で確かめてから枠と中身を描く(D76)。
// 枠(サイドバーのメニュー)と管理の門番の値も境界の内側: 断られた訪問者と殻には loading の箱だけが出る
export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <Guard fallback={<AdminLoading />}>
      {/* 門番の管理の枠: 守りの後で /admin の下の閉じた住所を足した値で包み直す(公開ページの HTML に管理の住所を出さない) */}
      <GateProvider state={clientGateState("admin")}>
        {/* 管理のコマンドパレットの移動の候補もこの枠の値で絞る(L2.4) */}
        <AdminCommandGateBridge />
        <AdminProtectedLayout>{children}</AdminProtectedLayout>
      </GateProvider>
    </Guard>
  );
}
