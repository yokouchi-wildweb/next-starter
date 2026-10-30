// src/app/debug/layout.tsx
//
// 管理者カテゴリ + デバッガーロール限定のデバッグ領域（/debug/**）。
// 方針は隣の guard.ts。この layout が guard() で一括で守るため、配下にページを置くだけでアクセス制限がかかる。

import type { ReactNode } from "react";

import { guard } from "./guard";

export default async function DebugLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
