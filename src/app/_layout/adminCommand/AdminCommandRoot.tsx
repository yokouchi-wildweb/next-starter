// src/app/_layout/adminCommand/AdminCommandRoot.tsx
// 管理者コマンドの一覧(生成物、src/app/_layout/adminCommand/extensions/)を AdminCommandProvider に結ぶ。
// 一覧の load は関数でサーバーからクライアントへ props で渡せないので、この結びはクライアント側に置く。

"use client";

import type { ReactNode } from "react";

import { categories } from "./extensions/categories";
import { plugins } from "./extensions/plugins";
import { AdminCommandProvider } from "@/features/core/adminCommand";

export function AdminCommandRoot({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AdminCommandProvider categories={categories} plugins={plugins}>
      {children}
    </AdminCommandProvider>
  );
}
