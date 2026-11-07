// src/features/core/admin/menu/items/settingSections.ts
// 設定の節(src/features/core/setting/sections/)をこの位置に並べる。題名・アイコン・ロールは節の定義から

import { SlidersHorizontal } from "lucide-react";

import type { AdminMenuItemDefinition } from "../types";

export const item: AdminMenuItemDefinition = {
  key: "settingSections",
  category: "system",
  order: 10,
  source: "settingSections",
  icon: SlidersHorizontal,
};
