// src/features/core/setting/menu.ts
//
// 設定セクションの一覧から管理メニュー用アイテム配列を生成する。
// admin-global-menu.config.ts の `システム設定` セクションの `items` にそのまま渡す。

import type { AdminMenuItem } from "@/config/ui/admin-global-menu.config";

import { sections } from "./extensions/sections";
import { listSections, settingSectionHref } from "./utils/sectionForm";

/**
 * allowRoles はメニュー側のロールフィルタ用にそのまま継承される。並び順は order 昇順。
 * 閉じた機能の節(section.feature)は住所が門番で閉じるので、管理のサイドバーの住所の絞り込みで行が消える
 */
export function buildSettingMenuItems(): AdminMenuItem[] {
  return listSections(sections).map((section) => ({
    title: section.label,
    href: settingSectionHref(section.key),
    icon: section.icon,
    allowRoles: section.allowRoles,
  }));
}
