/**
 * メニューアイテムのラベル表示（アイコン + テキスト）
 *
 * PC/SP共通で使用
 */

import type { IconComponent } from "@/components/Icons";

export type MenuItemLabelProps = {
  readonly label: string;
  readonly icon?: IconComponent;
  readonly showIcon?: boolean;
};

export const MenuItemLabel = ({ label, icon: Icon, showIcon = true }: MenuItemLabelProps) => (
  <span className="inline-flex items-center gap-1.5">
    {showIcon && Icon && <Icon className="size-4" />}
    {label}
  </span>
);
