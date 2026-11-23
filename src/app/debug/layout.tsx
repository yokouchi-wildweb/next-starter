// src/app/debug/layout.tsx
//
// 管理者カテゴリ + デバッガーロール限定のデバッグ領域（/debug/**）。
// 方針は隣の guard.ts。この layout が guard() で一括で守るため、配下にページを置くだけでアクセス制限がかかる。

import type { ReactNode } from "react";

import { guard, guardMetadata } from "./guard";

// 先に守りを通してから metadata を返す(断られた訪問者の応答に配下のページの題名を出さない。断りは投げて解決ごと止める)。
// 許された時は robots noindex・nofollow を配下の全ページが継承する。断られた応答(cacheComponents では 200 + 本文の中の転送)の
// 索引避けは proxy の飾り admin/plugs/proxyDecorators/noindex.ts の X-Robots-Tag(/debug 以下の全部の応答)
export const generateMetadata = guardMetadata({ robots: { index: false, follow: false } });

export default async function DebugLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await guard();

  return <>{children}</>;
}
