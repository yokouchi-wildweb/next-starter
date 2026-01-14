/**
 * PC用ナビゲーション
 *
 * sm:640px 以上で表示
 */

import { PcMenuItem } from "./PcMenuItem";
import type { NavigationMenuItem } from "../types";

export type PcNavigationProps = {
  readonly items: readonly NavigationMenuItem[];
  readonly showIcons?: boolean;
};

export const PcNavigation = ({ items, showIcons = true }: PcNavigationProps) => (
  <nav id="header-custom-pc-nav" className="hidden items-stretch text-sm font-medium sm:flex">
    {items.map((item) => (
      <PcMenuItem key={item.key} item={item} showIcon={showIcons} />
    ))}
  </nav>
);
