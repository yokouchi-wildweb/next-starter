// src/app/(user)/(protected)/mypage/account/loading.tsx
//
// アカウントの段の境界。この段はページを持ち、下にもページ(profile・email 等)がある: 下のページからこの段のページへの client の遷移では
// この段が共有されるので、ページの loader の守りはこの境界の内側で待つ(D76)。文字を持たない(殻に入るため)

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function MyPageAccountLoading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-transparent"
      spinnerClassName="h-12 w-12 text-background"
    />
  );
}
