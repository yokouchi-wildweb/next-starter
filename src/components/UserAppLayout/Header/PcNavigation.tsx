import { MenuItem } from "./MenuItem";
import type { NavigationMenuItem } from "./MenuItem";

export type DesktopNavigationProps = {
  readonly items: readonly NavigationMenuItem[];
};

export const PcNavigation = ({ items }: DesktopNavigationProps) => (
  <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
    {items.map((item) => (
      <MenuItem key={item.key} item={item} variant="desktop" />
    ))}
  </nav>
);
