// 新規登録の流れ(signup の layout の下全部)はボトムナビを隠し、スマホではフッターも隠す。書式: src/app/_layout/frame/README.md
import type { FrameDeclaration } from "@/app/_layout/frame";

export const frameDefault = {
  layout: { hide: { bottomNav: { sp: true, pc: true }, footer: { sp: true } } },
} satisfies FrameDeclaration;
