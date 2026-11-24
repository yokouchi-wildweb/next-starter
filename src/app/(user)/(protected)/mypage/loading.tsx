// src/app/(user)/(protected)/mypage/loading.tsx
//
// マイページの枠(./layout.tsx)の下の境界。枠の中の client の遷移(/mypage ↔ /mypage/account 等)では枠の layout が共有されて
// 再描画されないので、ページの loader の守り(範囲の評価)はこの境界の内側で待つ(D76)。文字を持たない(殻に入るため)

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function MyPageLoading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-transparent"
      spinnerClassName="h-12 w-12 text-background"
    />
  );
}
