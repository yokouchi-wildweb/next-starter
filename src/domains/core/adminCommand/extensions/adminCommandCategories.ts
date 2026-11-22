// 生成物・編集不可: pnpm generate extensions が src/domains/core/adminCommand/extensionPoints.ts から生成する
// adminCommandCategories: 差す側の <ドメイン>/plugs/adminCommandCategories/<名前>.ts(x) か <名前>/index.ts(x)(lib は <lib>/plugs/…)の export const category(並びは<差す側>/<名前> の順、使う時に gate.plugs で閉じたドメインの項目を外す)

import type { CategoryConfig } from "@/domains/core/adminCommand/base/types";

export const adminCommandCategories: { domain: string | null; name: string; requires: readonly string[]; load: () => Promise<CategoryConfig> }[] = [
  { domain: "adminCommand", name: "navigation", requires: [], load: () => import("@/domains/core/adminCommand/plugs/adminCommandCategories/navigation").then((m) => m.category) },
  { domain: "adminCommand", name: "settings", requires: [], load: () => import("@/domains/core/adminCommand/plugs/adminCommandCategories/settings").then((m) => m.category) },
  { domain: "adminCommand", name: "userSession", requires: [], load: () => import("@/domains/core/adminCommand/plugs/adminCommandCategories/userSession").then((m) => m.category) },
];
