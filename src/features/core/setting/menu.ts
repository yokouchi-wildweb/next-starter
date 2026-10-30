// src/features/core/setting/menu.ts
//
// 設定セクションの一覧から管理メニュー用アイテム配列を生成する。
// admin-global-menu.config.ts の `システム設定` セクションの `items` にそのまま渡す。

import type { AdminMenuItem } from "@/config/ui/admin-global-menu.config";

import { sections } from "./extensions/sections";
import { listSections } from "./utils/sectionForm";

/** allowRoles はメニュー側のロールフィルタ用にそのまま継承される。並び順は order 昇順 */
export function buildSettingMenuItems(): AdminMenuItem[] {
  return listSections(sections).map((section) => ({
    title: section.label,
    href: `/admin/settings/${section.key}`,
    icon: section.icon,
    allowRoles: section.allowRoles,
  }));
}
