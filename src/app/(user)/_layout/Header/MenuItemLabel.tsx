/**
 * メニューアイテムのラベル表示（アイコン + テキスト）
 *
 * PC/SP共通で使用
 */

import type { ReactNode } from "react";

import type { IconComponent } from "@/components/Icons";

export type MenuItemLabelProps = {
  readonly label: string;
  readonly icon?: IconComponent;
  readonly showIcon?: boolean;
  readonly id?: string;
  /** ラベル横に表示するバッジ */
  readonly badge?: ReactNode;
};

export const MenuItemLabel = ({ label, icon: Icon, showIcon = true, id, badge }: MenuItemLabelProps) => (
  <span id={id} className="inline-flex items-center gap-1.5">
    {showIcon && Icon && <Icon className="size-4" />}
    {label}
    {badge}
  </span>
);
