// src/domains/core/adminCommand/plugs/rootProviders/adminCommand.tsx
// 点 rootProviders(アプリ全体を包む Provider、宣言 src/app/_layout/extensionPoints.ts)の項目: 管理者コマンド(段 domain、認証セッションの内側)。
// 管理者コマンドの一覧(生成物 ../../extensions/adminCommandCategories・adminCommandPlugins)を門番で絞って AdminCommandProvider に結ぶ。
// 一覧の load は関数でサーバーからクライアントへ props で渡せないので、この結びはクライアント側に置く

"use client";

import type { ReactNode } from "react";

import { useGate } from "@/featureGate/client";

import { AdminCommandProvider } from "../../base/AdminCommandProvider";
import { adminCommandCategories } from "../../extensions/adminCommandCategories";
import { adminCommandPlugins } from "../../extensions/adminCommandPlugins";
import type { RootProvider } from "@/app/_layout/points";

export const stage = "domain";

function AdminCommandRoot({ children }: Readonly<{ children: ReactNode }>) {
  const gate = useGate();
  return (
    <AdminCommandProvider categories={gate.plugs(adminCommandCategories)} plugins={gate.plugs(adminCommandPlugins)}>
      {children}
    </AdminCommandProvider>
  );
}

export const provider: RootProvider = AdminCommandRoot;
