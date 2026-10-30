// src/lib/adminCommand/index.ts

/**
 * ========================================
 * 管理者コマンドパレット
 * ========================================
 *
 * 拡張の仕方: ./README.md
 */

// ========================================
// Core（コンポーネント・フック）
// ========================================
export { AdminCommandProvider, useAdminCommand } from "./base";

// ========================================
// Core Types
// ========================================
export type {
  CategoryRendererProps,
  PaletteView,
  CategoryConfig,
  AdminCommandPlugin,
  AdminCommandContextValue,
} from "./base";

// ========================================
// Definition Types
// ========================================
export type { NavigationItem, NavigationItemGroup, SettingFieldConfig, SettingInputType } from "./types";

// ========================================
// Definitions
// ========================================
export { navigationItems } from "./definitions/navigation";
export { settingFields } from "./definitions/settings";

// ========================================
// Utils
// ========================================
export { filterSearchInput } from "./utils";
