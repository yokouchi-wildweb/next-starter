import type { NavItem } from "./types";
import { NavigationItem } from "./NavigationItem";

export type DesktopNavigationProps = {
  readonly items: readonly NavItem[];
};

export const DesktopNavigation = ({ items }: DesktopNavigationProps) => (
  <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
    {items.map((item) => (
      <NavigationItem key={item.key} item={item} variant="desktop" />
    ))}
  </nav>
);
