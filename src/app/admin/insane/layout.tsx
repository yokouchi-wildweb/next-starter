// src/app/admin/insane/layout.tsx
//
// 方針(admin ロール・初期セットアップの誘導)は隣の guard.ts。

import type { ReactNode } from "react";

import { InsaneProtectedLayout } from "./_layout";
import { guard } from "./guard";

export default async function InsaneLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <InsaneProtectedLayout>{children}</InsaneProtectedLayout>;
}
