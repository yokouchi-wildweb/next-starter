// src/features/core/admin/dashboard/registry.ts

import {
  AdditionalMetricsSection,
  MainMetricsSection,
} from "./components/sections";
import type { AdminDashboardSection, AdminDashboardSectionComponent } from "./types";

/** セクションを表示の対応表に載せる(data の型をセクションごとに保ったまま並べるための入口) */
export function defineDashboardSection<TData>(id: string, Component: AdminDashboardSectionComponent<TData>): AdminDashboardSection {
  return { id, Component: Component as AdminDashboardSectionComponent<unknown> };
}

/**
 * 管理ダッシュボードに表示するセクションの登録リスト(表示の対応表)。
 * 配列順がそのまま画面の表示順になる。サーバーのデータが要るセクションは、同じ id の取得を
 * `services/server/sectionLoads.ts`(loader 側の登録表)に載せ、結果を props の data で受ける。
 *
 * ## ダウンストリームでの拡張方法
 *
 * - **追加**: `components/sections/` に新規 Section を作成し、ここに append(データが要るなら sectionLoads.ts にも同じ id で)
 * - **削除**: 該当行を配列から削除(sectionLoads.ts の同じ id も)
 * - **並べ替え**: 配列順を入れ替える
 * - **完全に差し替え**: 配列を全て自前のセクションに置き換える
 */
export const adminDashboardSections: AdminDashboardSection[] = [
  defineDashboardSection("main-metrics", MainMetricsSection),
  defineDashboardSection("additional-metrics", AdditionalMetricsSection),
];
