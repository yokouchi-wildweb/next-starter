/**
 * カスタムアイコン用の型定義
 *
 * LucideIconと完全互換のインターフェースを提供
 */

import type { LucideIcon, LucideProps } from "lucide-react";

/** LucideIconと同じprops型 */
export type CustomIconProps = LucideProps;

/** LucideIconと同じ型（ForwardRefExoticComponent） */
export type CustomIcon = LucideIcon;

/** アイコンコンポーネント型（実質LucideIconと同じ） */
export type IconComponent = LucideIcon;
