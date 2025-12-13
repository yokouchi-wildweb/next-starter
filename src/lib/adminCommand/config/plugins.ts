// src/lib/adminCommand/config/plugins.ts

/**
 * ========================================
 * プラグイン登録ファイル（編集可能）
 * ========================================
 *
 * カテゴリに以下が必要な場合はここに登録:
 * - Provider: カテゴリ固有の状態管理（コンテキスト）
 * - GlobalComponent: パレット外で常時表示するUI（ダイアログ、オーバーレイなど）
 *
 * 使用例:
 * ```
 * import { StatusChangeProvider, StatusChangeDialog } from "../definitions/status-change";
 *
 * export const plugins: AdminCommandPlugin[] = [
 *   {
 *     id: "status-change",
 *     Provider: StatusChangeProvider,
 *     GlobalComponent: StatusChangeDialog,
 *   },
 * ];
 * ```
 */

import type { AdminCommandPlugin } from "../core/types";

/**
 * プラグイン一覧
 */
export const plugins: AdminCommandPlugin[] = [
  // 現在登録されているプラグインはありません
  // 必要に応じてここに追加してください
];
