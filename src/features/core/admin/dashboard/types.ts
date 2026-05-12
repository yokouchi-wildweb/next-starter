// src/features/core/admin/dashboard/types.ts

import type { ReactNode } from "react";

/**
 * 管理ダッシュボードのセクションを描画する関数コンポーネント。
 *
 * - Server Component (async) でも Client Component (sync) でも可
 * - props を一切受け取らない設計により、各セクションは完全自己完結する
 * - 必要なデータ取得・機能フラグ判定・表示制御は全てセクション内部で行う
 *
 * この制約により、セクションをドロップインで追加・削除・差し替えできる。
 */
export type AdminDashboardSectionComponent =
  | (() => ReactNode)
  | (() => Promise<ReactNode>);

/**
 * 管理ダッシュボードに表示するセクションの定義。
 * `registry.ts` で配列としてまとめて宣言され、配列順に画面表示される。
 */
export type AdminDashboardSection = {
  /** セクション識別子。React key と HTML id に利用される */
  id: string;
  /** セクション本体の描画コンポーネント */
  Component: AdminDashboardSectionComponent;
};
