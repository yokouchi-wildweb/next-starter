// 準備中のページはヘッダーのナビ・フッター・ボトムナビを隠す(ヘッダー自体は残す)。書式: src/app/_layout/frame/README.md
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frame = {
  hide: { headerNav: { sp: true, pc: true }, footer: { sp: true, pc: true }, bottomNav: { sp: true, pc: true } },
} satisfies FrameDeclaration;
