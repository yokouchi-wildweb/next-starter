// 項目の型は config 側(src/config/ui/user-bottom-menu.config.ts)で定義する(config → app の依存を作らないため)。
// ここは枠の部品と旧パスの import 向けの re-export と、判別関数だけを持つ
import type { BottomNavItem, BottomNavMenuItem } from "@/config/ui/user-bottom-menu.config";

export type {
  BottomNavItem,
  BottomNavLinkItem,
  BottomNavMenuAction,
  BottomNavMenuItem,
} from "@/config/ui/user-bottom-menu.config";

/** メニュー項目か(type 省略 = リンク項目) */
export const isBottomNavMenuItem = (item: BottomNavItem): item is BottomNavMenuItem => item.type === "menu";
