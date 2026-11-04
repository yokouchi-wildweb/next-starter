// 生成物・編集不可: pnpm extensions:generate が src/app/admin の frame.ts / frame.override.ts から生成する
// 枠の表: 行 = 解決済みの最終の値(親の鎖と override を重ねた物)。照合は matchFrame(静的が先・長い方が先、当たる 1 行)。仕組み: src/app/_layout/frame/README.md

import type { FrameTable } from "@/app/_layout/frame";

export const frameTable = [] as const satisfies FrameTable;
