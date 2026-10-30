// 生成物・編集不可: pnpm extensions:generate が src/app/_layout/adminCommand/extensionPoints.ts から生成する
// categories: src/app/_layout/adminCommand/categories/<名前>[.<fork の名前>].ts(x) か <名前>[.<fork の名前>]/index.ts(x) の export const category(並びはファイル名の順)

import type { CategoryConfig } from "@/features/core/adminCommand/base/types";

export const categories: { name: string; load: () => Promise<CategoryConfig> }[] = [
  { name: "navigation", load: () => import("@/app/_layout/adminCommand/categories/navigation").then((m) => m.category) },
  { name: "settings", load: () => import("@/app/_layout/adminCommand/categories/settings").then((m) => m.category) },
  { name: "userSession", load: () => import("@/app/_layout/adminCommand/categories/userSession").then((m) => m.category) },
];
