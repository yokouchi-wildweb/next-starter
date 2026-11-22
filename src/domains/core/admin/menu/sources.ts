// src/domains/core/admin/menu/sources.ts
// 項目 source:"<名前>" が展開する行の出どころ。行の中身はそれぞれの出どころで編集する(メニュー側で行を足し引きしない)。
// - dataMenu: 生成の管理一覧(@/registry/adminDomains)の addToAdminDataMenu: true のドメイン
// - settingSections: 設定の節(点 settingSections、<ドメイン>/plugs/settingSections/。題名・アイコン・ロールは節の定義から)

import { openSections } from "@/domains/core/setting/definitions";
import type { PlugsFilter } from "@/featureGate/client";
import { listSections, settingSectionHref } from "@/domains/core/setting/utils/sectionForm";
import { adminDomains } from "@/registry/adminDomains";

import { dataMenuRows } from "./buildAdminMenu";
import type { AdminMenuRow, AdminMenuSourceName } from "./types";

/** 設定の節を order 順に 1 行ずつ(閉じたドメインの節は外す) */
export function settingSectionRows(plugs: PlugsFilter): AdminMenuRow[] {
  return listSections(openSections(plugs)).map((section) => ({
    label: section.label,
    href: settingSectionHref(section.key),
    icon: section.icon,
    allowRoles: section.allowRoles,
  }));
}

/** 全出どころの行(組み立て器の sources に渡す。plugs = 門番の絞り、useAdminMenu は useGate().plugs) */
export function adminMenuSources(plugs: PlugsFilter): Record<AdminMenuSourceName, AdminMenuRow[]> {
  return { dataMenu: dataMenuRows(adminDomains), settingSections: settingSectionRows(plugs) };
}
