// src/app/(user)/(protected)/wallet/[slug]/purchase/loading.tsx
//
// 遷移に共有される段の境界: この段の下のページ同士・下のページとこの段のページの間の client の遷移ではこの段が共有されるので、
// ページの loader の守りはこの境界の内側で待つ(D76。地図の検査が守りの範囲の共有される段に loading を求める)。文字を持たない(殻に入るため)

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function WalletPurchaseLoading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-transparent"
      spinnerClassName="h-12 w-12 text-background"
    />
  );
}
