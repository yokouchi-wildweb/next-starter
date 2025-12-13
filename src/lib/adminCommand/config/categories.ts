// src/lib/adminCommand/config/categories.ts

/**
 * ========================================
 * カテゴリ登録ファイル（編集可能）
 * ========================================
 *
 * 新しいカテゴリを追加する場合:
 * 1. definitions/ に専用フォルダを作成
 * 2. レンダラーコンポーネントを実装
 * 3. このファイルの categories 配列に登録
 */

import type { CategoryConfig } from "../core/types";
import { NavigationRenderer } from "../definitions/navigation/NavigationRenderer";
import { SettingsRenderer } from "../definitions/settings/SettingsRenderer";

/**
 * 第1メニューに表示するカテゴリ一覧
 */
export const categories: CategoryConfig[] = [
  {
    id: "navigation",
    label: "ナビゲーション (navigate)",
    description: "ページ移動",
    Renderer: NavigationRenderer,
  },
  {
    id: "settings",
    label: "アプリ設定の変更 (config)",
    description: "設定値を変更",
    Renderer: SettingsRenderer,
  },
];
