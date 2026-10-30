// src/features/core/admin/dashboard/types.ts

import type { ReactNode } from "react";

/** セクションが受け取る props。data = そのセクションの load の結果(load を持たないセクションは undefined) */
export type AdminDashboardSectionProps<TData = undefined> = { data: TData };

/**
 * 管理ダッシュボードのセクションを描画する関数コンポーネント。
 *
 * - Server Component (async) でも Client Component (sync) でも可
 * - サーバーのデータは自分で取らず、`services/server/sectionLoads.ts` の同じ id の load の結果を props の data で受ける
 *   (取得は AdminHome の loader が範囲の守りを通った後に実行する)
 * - 機能フラグ判定・表示制御はセクション内部で行う
 */
export type AdminDashboardSectionComponent<TData = undefined> =
  | ((props: AdminDashboardSectionProps<TData>) => ReactNode)
  | ((props: AdminDashboardSectionProps<TData>) => Promise<ReactNode>);

/**
 * 管理ダッシュボードに表示するセクションの定義(表示の対応表の 1 行)。
 * `registry.ts` で配列としてまとめて宣言され、配列順に画面表示される。
 */
export type AdminDashboardSection = {
  /** セクション識別子。React key と HTML id、load との対応に利用される */
  id: string;
  /** セクション本体の描画コンポーネント(data の型はセクションごと。defineDashboardSection で登録する) */
  Component: AdminDashboardSectionComponent<unknown>;
};

/** セクションのデータの取得(loader 側の登録表 services/server/sectionLoads.ts の 1 行) */
export type AdminDashboardSectionLoad = () => Promise<unknown>;

/** ダッシュボードの loader が返す、セクション id → load の結果 */
export type AdminDashboardData = Record<string, unknown>;
