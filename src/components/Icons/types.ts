/**
 * カスタムアイコン用の型定義
 *
 * LucideIconと互換性のあるインターフェースを提供
 */

import type { LucideIcon, LucideProps } from "lucide-react";

/** LucideIconと互換性のあるprops型 */
export type CustomIconProps = LucideProps;

/** LucideIconと同じインターフェースを持つアイコンコンポーネント型 */
export type CustomIcon = React.FC<CustomIconProps>;

/**
 * アイコンコンポーネント型（LucideIcon と CustomIcon の両方を受け入れる）
 *
 * LucideIconはForwardRefExoticComponent、CustomIconはReact.FCで
 * 型レベルでは互換性がないため、共通の型を定義
 */
export type IconComponent = LucideIcon | CustomIcon;
