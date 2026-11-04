// src/app/admin/(protected)/_layout/Sidebar/sidebarSections.ts
// 管理のサイドバーの節の組み立て(純関数。BaseSidebar が呼び、テストが直接呼ぶ)。
// - allowRoles(節・行)でロールに合わない物を除く
// - 門番: 閉じた機能の住所の行を除く(filter = useGate().filter。判定は server の gate.filter と同じ、値は守りの後に server が計算した管理の枠: L1.11)
//   節の href が閉じていれば href を外し、行が 0 で href も無い節は描かない(見出しだけが残らない)

import type { IconComponent } from "@/components/Icons";
import type { AdminMenuSection } from "@/config/ui/admin-global-menu.config";

export type SidebarMenuItem = {
  title: string;
  href: string;
  icon?: IconComponent;
  allowRoles?: readonly string[];
};

export type SidebarMenuSection = {
  title: string;
  href: string | null;
  items: SidebarMenuItem[];
  icon?: IconComponent;
};

/** 閉じた機能の住所の項目を除く関数(useGate().filter と同じ形) */
export type GateFilter = <T>(items: readonly T[], getHref: (item: T) => string | undefined) => T[];

const hasHref = (href: string | null | undefined): href is string =>
  typeof href === "string" && href.length > 0;

/**
 * allowRoles によるフィルタ判定
 * - allowRoles 未指定/空 → 全員表示
 * - ユーザーロールが allowRoles に含まれているか
 */
const isAllowedForRole = (
  allowRoles: readonly string[] | undefined,
  userRole: string | undefined,
): boolean => {
  if (!allowRoles || allowRoles.length === 0) return true;
  return userRole ? allowRoles.includes(userRole) : false;
};

/** メニュー設定からサイドバー用の節の一覧を作る(ロールと門番で絞る) */
export function buildSidebarSections(
  menu: readonly AdminMenuSection[],
  userRole: string | undefined,
  gateFilter: GateFilter,
): SidebarMenuSection[] {
  return menu
    .filter((section) => isAllowedForRole(section.allowRoles, userRole))
    .flatMap((section) => {
      const ownHref = hasHref(section.href) ? section.href : null;
      const primaryHref = ownHref !== null && gateFilter([ownHref], (href) => href).length > 0 ? ownHref : null;

      const candidates = section.items.filter(
        (item) => hasHref(item.href) && isAllowedForRole(item.allowRoles, userRole),
      );
      const items: SidebarMenuItem[] = gateFilter(candidates, (item) => item.href).map((item) => ({
        title: item.title,
        href: item.href,
        icon: item.icon,
        allowRoles: item.allowRoles,
      }));

      if (items.length === 0 && primaryHref === null) return [];
      return [{ title: section.title, href: primaryHref, items, icon: section.icon }];
    });
}
