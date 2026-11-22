// src/app/_layout/FrameParts.tsx
// 枠の名前付きの増設点(userHeaderActions・userOverlays・adminOverlays …)の項目を描く。生成された一覧を門番(useGate().plugs)で絞り、
// 閉じたドメインの部品は名前ごと消える(D25)。並びは一覧の並び(生成器が点の宣言どおりに並べる)

"use client";

import { Fragment } from "react";

import { useGate } from "@/featureGate/client";

import type { FramePart } from "./types";

type FramePartEntry = { domain: string | null; name: string; requires: readonly string[]; plug: FramePart };

export function FrameParts({ items }: Readonly<{ items: readonly FramePartEntry[] }>) {
  const open = useGate().plugs(items);
  return (
    <>
      {open.map(({ domain, name, plug: Part }) => (
        <Fragment key={`${domain ?? "lib"}/${name}`}>
          <Part />
        </Fragment>
      ))}
    </>
  );
}
