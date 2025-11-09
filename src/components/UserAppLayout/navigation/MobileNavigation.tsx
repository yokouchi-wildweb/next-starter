import type { NavItem } from "./types";
import { NavigationItem } from "./NavigationItem";

export type MobileNavigationProps = {
  readonly isOpen: boolean;
  readonly items: readonly NavItem[];
  readonly onClose: () => void;
};

export const MobileNavigation = ({ isOpen, items, onClose }: MobileNavigationProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <nav className="sm:hidden">
      <ul className="space-y-2 border-t border-border px-4 pb-4 pt-3 text-sm font-medium">
        {items.map((item) => (
          <li key={item.key}>
            <NavigationItem item={item} variant="mobile" onNavigate={onClose} />
          </li>
        ))}
      </ul>
    </nav>
  );
};
