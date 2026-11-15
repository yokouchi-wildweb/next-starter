// src/features/core/admin/dashboard/buildAdminDashboard.ts
// 管理ダッシュボードの組み立て器(純関数。React・門番を直に使わない)。
// 手順: 定義(override は生成の一覧で重なり済み)を order・key 順 → hidden → ロール → 門番の規則(feature)で絞る。
// 見え方は認可ではない(画面の守りは範囲の guard.ts と loader の access)。仕組み: ./README.md

import type {
  AdminDashboardHiddenEntry,
  AdminDashboardSectionDefinition,
  BuildAdminDashboardInput,
  BuiltAdminDashboard,
} from "./types";

/** allowRoles 未指定・空 = 全員。指定があればロールが含まれるときだけ */
const allows = (allowRoles: readonly string[] | undefined, role: string | undefined): boolean =>
  !allowRoles || allowRoles.length === 0 ? true : role !== undefined && allowRoles.includes(role);

/** order 昇順、同じ値は key 順 */
const byOrderThenKey = (a: AdminDashboardSectionDefinition, b: AdminDashboardSectionDefinition): number =>
  a.order - b.order || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * 1 セクションを定義する(data の型を Section と load の間で保ったまま、一覧の要素の型にそろえる)。
 * sections/<key>.ts(x) は `export const section = defineDashboardSection({ … })` と書く
 */
export function defineDashboardSection<TData = undefined>(
  definition: AdminDashboardSectionDefinition<TData>,
): AdminDashboardSectionDefinition {
  return definition as unknown as AdminDashboardSectionDefinition;
}

export function buildAdminDashboard(input: BuildAdminDashboardInput): BuiltAdminDashboard {
  const hidden: AdminDashboardHiddenEntry[] = [];
  const sections: AdminDashboardSectionDefinition[] = [];
  for (const section of Object.values(input.sections).sort(byOrderThenKey)) {
    if (section.hidden) {
      hidden.push({ key: section.key, reason: "hidden" });
      continue;
    }
    if (!allows(section.allowRoles, input.role)) {
      hidden.push({ key: section.key, reason: "role" });
      continue;
    }
    if (section.feature !== undefined && !input.isEnabled(section.feature)) {
      hidden.push({ key: section.key, reason: "closed", feature: section.feature });
      continue;
    }
    sections.push(section);
  }
  return { sections, hidden };
}
