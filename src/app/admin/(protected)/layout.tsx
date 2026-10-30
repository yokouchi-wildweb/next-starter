// src/app/admin/(protected)/layout.tsx
//
// 方針(管理者カテゴリ・初期セットアップの誘導)は隣の guard.ts。

import type { ReactNode } from "react";

import { AdminProtectedLayout } from "./_layout/AdminProtectedLayout";
import { guard } from "./guard";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <AdminProtectedLayout>{children}</AdminProtectedLayout>;
}
