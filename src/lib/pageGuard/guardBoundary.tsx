// src/lib/pageGuard/guardBoundary.tsx
//
// 範囲の守りの境界(範囲の layout が描く <Guard fallback={…}>{children}</Guard>)。layout の頭で守りを待たず、
// 境界(Suspense)の内側の部品が範囲の全段を評価してから children を返す。断られた訪問者には redirect / notFound を
// 中で投げ、children は描かれない(守りの強さは layout の頭で待つ形と同じ)。境界の外の layout と fallback は待たないので、
// client の遷移で範囲に入る時も Next の instant の検証が「境界の外で要求を待つ」と言わない(D76)

import { Suspense, type ReactNode } from "react";

export type GuardProps = {
  /** 守りを確かめる間に出す物(その範囲の loading と同じ見た目、文字を持たない: 殻に入るため) */
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
