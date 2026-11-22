// src/app/_layout/adminCommand/categories/settings.tsx

import type { CategoryConfig } from "@/domains/core/adminCommand/base/types";
import { SettingsRenderer } from "@/domains/core/adminCommand/definitions/settings/SettingsRenderer";

export const category: CategoryConfig = {
  id: "settings",
  label: "アプリ設定の変更 (config)",
  description: "設定値を変更",
  Renderer: SettingsRenderer,
};
