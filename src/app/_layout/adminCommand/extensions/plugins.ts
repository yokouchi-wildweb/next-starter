// 生成物・編集不可: pnpm extensions:generate が src/app/_layout/adminCommand/extensionPoints.ts から生成する
// plugins: src/app/_layout/adminCommand/plugins/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const plugin(並びはファイル名の順)

import type { AdminCommandPlugin } from "@/features/core/adminCommand/base/types";

export const plugins: { name: string; load: () => Promise<AdminCommandPlugin> }[] = [];
