// src/domains/core/adminCommand/plugs/adminCommandCategories/navigation.tsx

import type { CategoryConfig } from "../../base/types";
import { NavigationRenderer } from "../../definitions/navigation/NavigationRenderer";

export const category: CategoryConfig = {
  id: "navigation",
  label: "ナビゲーション (navigate)",
  description: "ページ移動",
  Renderer: NavigationRenderer,
};
