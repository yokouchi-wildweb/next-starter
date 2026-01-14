import { MenuItem } from "./MenuItem";
import type { NavigationMenuItem } from "./MenuItem";

export type DesktopNavigationProps = {
  readonly items: readonly NavigationMenuItem[];
  readonly showIcons?: boolean;
};

export const PcNavigation = ({ items, showIcons = true }: DesktopNavigationProps) => (
  <nav className="hidden items-stretch text-sm font-medium sm:flex">
    {items.map((item) => (
      <MenuItem key={item.key} item={item} variant="desktop" showIcon={showIcons} />
    ))}
  </nav>
);
