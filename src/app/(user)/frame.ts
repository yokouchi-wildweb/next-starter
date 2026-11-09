// 利用者の枠の既定(ルートを作ったリポ = 上流の宣言)。書式: src/app/_layout/frame/README.md
// layout: この layout の下の全ページ = ボトムナビはスマホだけ(PC では隠す)
// page: トップページ(/)だけ = 本文が画面の高さを埋める(StarterHomeScreen)
// 下のリポ(fork・中間 Tier)が変えるときは隣に frame.override.ts(export const override、同じ形)を置く
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frame = {
  layout: { hide: { bottomNav: { pc: true } } },
  page: { fill: true },
} satisfies FrameDeclaration;
