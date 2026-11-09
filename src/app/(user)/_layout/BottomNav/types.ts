// 項目の型は枠の描画用の設定 ../config.ui.ts で定義する(項目の既定と一緒に置く)。
// ここは枠の部品と旧パスの import 向けの re-export と、判別関数だけを持つ
import type { BottomNavItem, BottomNavMenuItem } from "../config.ui";

export type {
  BottomNavItem,
  BottomNavLinkItem,
  BottomNavMenuAction,
  BottomNavMenuItem,
} from "../config.ui";

/** メニュー項目か(type 省略 = リンク項目) */
export const isBottomNavMenuItem = (item: BottomNavItem): item is BottomNavMenuItem => item.type === "menu";
