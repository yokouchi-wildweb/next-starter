// src/features/core/setting/menu.ts
//
// 設定セクション定義から管理メニュー用アイテム配列を生成する。
// admin-global-menu.config.ts の `システム設定` セクションの `items` にそのまま差し込む想定。

import type { AdminMenuItem } from "@/config/ui/admin-global-menu.config";

import { listSettingSections } from "./setting.sections";

/**
 * 設定セクションを管理メニューのアイテム配列に変換する
 *
 * - `allowRoles` はメニュー側のロールフィルタ用にそのまま継承される
 * - 並び順は `order` 昇順
 */
export function buildSettingMenuItems(): AdminMenuItem[] {
  return listSettingSections().map(([key, section]) => ({
    title: section.label,
    href: `/admin/settings/${key}`,
    icon: section.icon,
    allowRoles: section.allowRoles,
  }));
}
