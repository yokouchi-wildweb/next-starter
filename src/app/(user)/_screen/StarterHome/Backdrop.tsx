// src/app/(user)/_screen/StarterHome/Backdrop.tsx
// トップページの背景。テーマトークンだけで組んだ薄いグラデーション + ドットグリッド。
// JS もアニメーションも持たないので軽く、ダークモードにも自動追従する。

import { Block } from "@/components/Layout/Block";

export function Backdrop() {
  return (
    <Block aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* 左上: accent の淡い光 */}
      <Block className="absolute -left-32 -top-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--color-accent)_22%,transparent),transparent)] blur-2xl" />
      {/* 右下: primary の淡い光 */}
      <Block className="absolute -bottom-48 -right-24 size-[32rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--color-primary)_14%,transparent),transparent)] blur-2xl" />
      {/* ドットグリッド（中央から外側へフェード） */}
      <Block className="absolute inset-0 bg-[radial-gradient(color-mix(in_oklch,var(--color-foreground)_14%,transparent)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
    </Block>
  );
}
