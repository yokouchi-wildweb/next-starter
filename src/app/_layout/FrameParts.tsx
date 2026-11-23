// src/app/_layout/FrameParts.tsx
// 枠の名前付きの増設点(userHeaderActions・userOverlays・adminOverlays …)の項目を描く。生成された一覧を門番(useGate().plugs)で絞り、
// 閉じたドメインの部品は名前ごと消える(D25)。並びは一覧の並び(生成器が点の宣言どおりに並べる)
// 門番の読みも各項目も Suspense(fallback null)の内側で描く: 項目がセッション・URL を読んでも、枠(殻に入る会員の枠)と他の項目を止めない
// (包みが無いと、読む項目が同じ境界の枠ごと流れの終わりまで隠す)。fork が差した項目も同じ形で効く

"use client";

import { Fragment, Suspense } from "react";

import { useGate } from "@/featureGate/client";

import type { FramePart } from "./types";

type FramePartEntry = { domain: string | null; name: string; requires: readonly string[]; plug: FramePart };

function OpenFrameParts({ items }: Readonly<{ items: readonly FramePartEntry[] }>) {
  const open = useGate().plugs(items);
  return (
    <>
      {open.map(({ domain, name, plug: Part }) => (
        <Fragment key={`${domain ?? "lib"}/${name}`}>
          <Suspense fallback={null}>
            <Part />
          </Suspense>
        </Fragment>
      ))}
    </>
  );
}

export function FrameParts({ items }: Readonly<{ items: readonly FramePartEntry[] }>) {
  return (
    <Suspense fallback={null}>
      <OpenFrameParts items={items} />
    </Suspense>
  );
}
