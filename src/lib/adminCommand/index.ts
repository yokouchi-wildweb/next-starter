// src/lib/adminCommand/index.ts

/**
 * ========================================
 * 管理者コマンドパレット
 * ========================================
 *
 * 拡張する場合は以下のファイルを編集:
 * - config/categories.ts: カテゴリの追加
 * - config/plugins.ts: Provider/GlobalComponent の追加
 * - definitions/: カテゴリ実装の追加
 *
 * core/ 内のファイルは編集しないでください
 */

// ========================================
// Core（コンポーネント・フック）
// ========================================
export { AdminCommandProvider, useAdminCommand } from "./core";

// ========================================
// Core Types
// ========================================
export type {
  CategoryRendererProps,
  PaletteView,
  CategoryConfig,
  AdminCommandPlugin,
  AdminCommandContextValue,
} from "./core";

// ========================================
// Config
// ========================================
export { categories } from "./config/categories";
export { plugins } from "./config/plugins";

// ========================================
// Definition Types
// ========================================
export type { NavigationItem, SettingFieldConfig, SettingInputType } from "./types";

// ========================================
// Definitions
// ========================================
export { navigationItems } from "./definitions/navigation";
export { settingFields } from "./definitions/settings";

// ========================================
// Utils
// ========================================
export { filterSearchInput } from "./utils";
