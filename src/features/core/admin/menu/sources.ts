// src/features/core/admin/menu/sources.ts
// 項目 source:"<名前>" が展開する行の出どころ。行の中身はそれぞれの出どころで編集する(メニュー側で行を足し引きしない)。
// - dataMenu: 生成の管理一覧(@/registry/adminDomains)の addToAdminDataMenu: true のドメイン
// - settingSections: 設定の節(src/features/core/setting/sections/。題名・アイコン・ロールは節の定義から)

import { sections } from "@/features/core/setting/extensions/sections";
import { listSections, settingSectionHref } from "@/features/core/setting/utils/sectionForm";
import { adminDomains } from "@/registry/adminDomains";

import { dataMenuRows } from "./buildAdminMenu";
import type { AdminMenuRow, AdminMenuSourceName } from "./types";

/** 設定の節を order 順に 1 行ずつ */
export function settingSectionRows(): AdminMenuRow[] {
  return listSections(sections).map((section) => ({
    label: section.label,
    href: settingSectionHref(section.key),
    icon: section.icon,
    allowRoles: section.allowRoles,
  }));
}

/** 全出どころの行(組み立て器の sources に渡す) */
export function adminMenuSources(): Record<AdminMenuSourceName, AdminMenuRow[]> {
  return { dataMenu: dataMenuRows(adminDomains), settingSections: settingSectionRows() };
}
