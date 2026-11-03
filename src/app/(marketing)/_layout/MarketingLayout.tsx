// src/app/(marketing)/_layout/MarketingLayout.tsx
//
// (marketing) の既定の枠。枠を持たない素通しで、ページが画面の全面を持つ(ヘッダー・フッター・slot は無い)。
// fork が LP に共通の枠(ヘッダー等)を付けたいときは、隣に MarketingLayout.replace.tsx を置き、
// ../layout.tsx をそちらへ向ける(./README.md)。

import type { ReactNode } from "react";

export type MarketingLayoutProps = Readonly<{ children: ReactNode }>;

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return <>{children}</>;
}
