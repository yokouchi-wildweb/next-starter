// src/app/debug/layout.tsx
//
// 管理者カテゴリ + デバッガーロール限定のデバッグ領域（/debug/**）。
// 方針は隣の guard.ts。この layout が guard() で一括で守るため、配下にページを置くだけでアクセス制限がかかる。

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { guard } from "./guard";

// 検索エンジンに載せない(robots noindex・nofollow、配下の全ページが継承する)。守られた範囲は、cacheComponents では
// 未ログインでも 307 ではなく本文の中の転送で 200 になりうる(中身は出ない)ので、その応答を索引させない
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DebugLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
