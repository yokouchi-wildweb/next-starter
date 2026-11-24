// src/app/admin/(protected)/__domainsSlug__/loading.tsx — 一覧の段の境界
//
// pnpm generate domain はこのファイルを初回だけ生成し、以後は上書きしない(write-once)。
// この段は一覧のページを持ち、下にも new/・[id]/edit/ のページがある: 下のページから一覧への client の遷移ではこの段が共有されるので、
// 一覧の loader の守りはこの境界の内側で待つ(D76。地図の検査が守りの範囲の共有される段に loading を求める)。文字を持たない(殻に入るため)

import { ScreenLoader } from "@/components/Overlays/Loading";

export default function Admin__Domain__Loading() {
  return (
    <ScreenLoader
      mode="fullscreen"
      className="bg-muted"
      spinnerClassName="h-12 w-12 text-primary"
    />
  );
}
