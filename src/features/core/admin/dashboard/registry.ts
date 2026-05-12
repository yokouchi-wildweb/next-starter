// src/features/core/admin/dashboard/registry.ts

import {
  AdditionalMetricsSection,
  MainMetricsSection,
} from "./components/sections";
import type { AdminDashboardSection } from "./types";

/**
 * 管理ダッシュボードに表示するセクションの登録リスト。
 * 配列順がそのまま画面の表示順になる。
 *
 * ## ダウンストリームでの拡張方法
 *
 * - **追加**: `components/sections/` に新規 Section を作成し、ここに append
 * - **削除**: 該当行を配列から削除
 * - **並べ替え**: 配列順を入れ替える
 * - **完全に差し替え**: 配列を全て自前のセクションに置き換える
 *
 * 各 Section は props を受け取らない自己完結コンポーネントであり、
 * データ取得・機能フラグ判定・表示制御は全て Section 内部で行う。
 * これにより、本ファイルと page.tsx を触らずに、Section 単位で
 * 独立して開発・差し替え・削除が可能。
 */
export const adminDashboardSections: AdminDashboardSection[] = [
  { id: "main-metrics", Component: MainMetricsSection },
  { id: "additional-metrics", Component: AdditionalMetricsSection },
];
