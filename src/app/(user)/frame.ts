// 利用者の枠の全体の既定(このフォルダの下の全ページ)。書式: src/app/_layout/frame/README.md
// ボトムナビはスマホだけ(PC では隠す)。fork が変えるときは隣に frame.override.ts を置く
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frame = {
  hide: { bottomNav: { pc: true } },
} satisfies FrameDeclaration;
