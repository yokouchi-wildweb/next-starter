// src/features/core/admin/dashboard/types.ts
// 管理ダッシュボードのセクションの定義の型(受け口 ./sections/。一覧は ../extensions/dashboardSections.ts の生成物)と、
// 組み立て器(./buildAdminDashboard.ts)の入出力の型。仕組み: ./README.md

import type { ReactNode } from "react";

import type { FeatureName } from "@/featureGate";
import type { UserRoleType } from "@/features/core/user/types";

/** セクションが受け取る props。data = そのセクションの load の結果(load を持たないセクションは undefined) */
export type AdminDashboardSectionProps<TData = undefined> = { data: TData };

/**
 * 管理ダッシュボードのセクションを描画する関数コンポーネント。
 *
 * - Server Component (async) でも Client Component (sync) でも可
 * - サーバーのデータは自分で取らず、同じ定義の load の結果を props の data で受ける
 *   (取得は AdminHome の loader が範囲の守りを通った後に実行する)
 */
export type AdminDashboardSectionComponent<TData = undefined> =
  | ((props: AdminDashboardSectionProps<TData>) => ReactNode)
  | ((props: AdminDashboardSectionProps<TData>) => Promise<ReactNode>);

/** セクションのデータの取得(server。AdminHome の loader が範囲の守りを通った後に実行する) */
export type AdminDashboardSectionLoad<TData = unknown> = () => Promise<TData>;

/**
 * 1 セクションの定義(sections/<key>.ts(x) の export const section。defineDashboardSection で書く)。
 * 描画(Section)と取得(load)を同じ定義に並べる。見え方は門番の規則(feature)と allowRoles だけで決める
 */
export type AdminDashboardSectionDefinition<TData = unknown> = {
  /** 一意の名前 = ファイル名(英字始まりの英数字、camelCase)。override の対象もこの名前。React key に使う */
  key: string;
  /** 並び(昇順。上流のセクションは 100 刻み、同じ値は key 順) */
  order: number;
  /** 描画 */
  Section: AdminDashboardSectionComponent<TData>;
  /** 取得(省略 = data は undefined) */
  load?: AdminDashboardSectionLoad<TData>;
  /** 見せるロール(省略・空 = 全員) */
  allowRoles?: UserRoleType[];
  /** 門番の規則の名前。閉じていれば描かず、取得もしない */
  feature?: FeatureName;
  /** override だけが使う: セクションを描かない(取得もしない) */
  hidden?: boolean;
};

/** 上流のセクションの隣の <key>.override.ts で変えられる属性(allowRoles は絞るだけ: pnpm check admin-menu が見る) */
export type AdminDashboardSectionOverride = Partial<Pick<AdminDashboardSectionDefinition, "hidden" | "allowRoles" | "order">>;

/** ダッシュボードの loader が返す、描くセクションの key → load の結果(キーがある = 描く。load の無いセクションは undefined) */
export type AdminDashboardData = Record<string, unknown>;

export type BuildAdminDashboardInput = {
  sections: Readonly<Record<string, AdminDashboardSectionDefinition>>;
  /** 見る人のロール(undefined = ロール指定のある物は全部見えない) */
  role: string | undefined;
  /** 規則が開いているか(server は gate.enabled) */
  isEnabled: (feature: FeatureName) => boolean;
};

export type AdminDashboardHiddenReason = "hidden" | "role" | "closed";

/** 描かなかったセクションと理由 */
export type AdminDashboardHiddenEntry = { key: string; reason: AdminDashboardHiddenReason; feature?: FeatureName };

export type BuiltAdminDashboard = {
  /** 描くセクション(order・key 順) */
  sections: AdminDashboardSectionDefinition[];
  hidden: AdminDashboardHiddenEntry[];
};
