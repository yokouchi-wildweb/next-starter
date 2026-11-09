// デモログインのページはフッターとボトムナビを隠す。書式: src/app/_layout/frame/README.md
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frame = {
  page: { hide: { footer: { sp: true, pc: true }, bottomNav: { sp: true, pc: true } } },
} satisfies FrameDeclaration;
