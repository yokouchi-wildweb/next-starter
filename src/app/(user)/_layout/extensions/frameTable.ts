// 生成物・編集不可: pnpm generate extensions が src/app/(user) の frame.ts / frame.override.ts から生成する
// 枠の表: 行 = 解決済みの最終の値(親の鎖と frame → frame.override を重ねた物)。照合は matchFrame(静的が先・長い方が先、当たる 1 行)。仕組み: src/app/_layout/frame/README.md

import type { FrameTable } from "@/app/_layout/frame";

export const frameTable = [
  { pattern: ["(auth)","demo-login"], scope: "page", hide: ["footer-sp","footer-pc","bottom-nav-sp","bottom-nav-pc"], fill: false },
  { pattern: ["(auth)","signup"], scope: "layout", hide: ["footer-sp","bottom-nav-sp","bottom-nav-pc"], fill: false },
  { pattern: [], scope: "layout", hide: ["bottom-nav-pc"], fill: false },
  { pattern: ["maintenance"], scope: "page", hide: ["header-nav-sp","header-nav-pc","footer-sp","footer-pc","bottom-nav-sp","bottom-nav-pc"], fill: false },
  { pattern: [], scope: "page", hide: ["bottom-nav-pc"], fill: true },
] as const satisfies FrameTable;
