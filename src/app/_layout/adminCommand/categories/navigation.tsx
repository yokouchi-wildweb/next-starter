// src/app/_layout/adminCommand/categories/navigation.tsx

import type { CategoryConfig } from "@/features/core/adminCommand/base/types";
import { NavigationRenderer } from "@/features/core/adminCommand/definitions/navigation/NavigationRenderer";

export const category: CategoryConfig = {
  id: "navigation",
  label: "ナビゲーション (navigate)",
  description: "ページ移動",
  Renderer: NavigationRenderer,
};
