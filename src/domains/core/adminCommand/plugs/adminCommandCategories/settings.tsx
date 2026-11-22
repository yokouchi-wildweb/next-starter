// src/domains/core/adminCommand/plugs/adminCommandCategories/settings.tsx

import type { CategoryConfig } from "../../base/types";
import { SettingsRenderer } from "../../definitions/settings/SettingsRenderer";

export const category: CategoryConfig = {
  id: "settings",
  label: "アプリ設定の変更 (config)",
  description: "設定値を変更",
  Renderer: SettingsRenderer,
};
