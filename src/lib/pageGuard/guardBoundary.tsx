// src/lib/pageGuard/guardBoundary.tsx
//
// 範囲の守りの境界(範囲の layout が描く <Guard fallback={…}>{children}</Guard>)。layout の頭で守りを待たず、
// 境界(Suspense)の内側の部品が範囲の全段を評価してから children(枠と子の入口)を返す。断られた訪問者には
// redirect / notFound を中で投げ、children は描かれない。ページの区画は Guard と別に描かれるので、ページの中身と題名を
// 止めるのは画面の作り手 createScreen(lib/screens)、データは loader が独立に認可する(D105)。境界の外の layout と fallback は待たないので、
// client の遷移で範囲に入る時も Next の instant の検証が「境界の外で要求を待つ」と言わない(D76)

import { Suspense, type ReactNode } from "react";

export type GuardProps = {
  /** 守りを確かめる間に出す物(上流は待つ間の既定 ScreenWait。文字を持たない: 殻に入るため) */
  readonly fallback: ReactNode;
  readonly children: ReactNode;
};

/** 範囲の全段の評価(enforceRange)を受けて、その範囲の境界の部品を作る */
export function createGuardBoundary(enforceRange: () => Promise<unknown>) {
  async function Guarded({ children }: { readonly children: ReactNode }) {
    await enforceRange();
    return <>{children}</>;
  }

  return function Guard({ fallback, children }: GuardProps) {
    return (
      <Suspense fallback={fallback}>
        <Guarded>{children}</Guarded>
      </Suspense>
    );
  };
}
