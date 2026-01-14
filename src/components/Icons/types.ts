/**
 * カスタムアイコン用の型定義
 *
 * LucideIconと互換性のあるインターフェースを提供
 */

import type { LucideProps } from "lucide-react";

/** LucideIconと互換性のあるprops型 */
export type CustomIconProps = LucideProps;

/** LucideIconと同じインターフェースを持つアイコンコンポーネント型 */
export type CustomIcon = React.FC<CustomIconProps>;
