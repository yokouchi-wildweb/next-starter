import { Menu, X } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";

export type NavigationToggleButtonProps = {
  readonly isMenuOpen: boolean;
  readonly onToggle: () => void;
};

export const SpNavSwitch = ({ isMenuOpen, onToggle }: NavigationToggleButtonProps) => (
  <Button
    id="header-custom-sp-menu-toggle"
    type="button"
    variant="outline"
    size="icon"
    className="sm:hidden"
    aria-label="メニューを開閉"
    aria-expanded={isMenuOpen}
    onClick={onToggle}
  >
    {isMenuOpen ? <X id="header-custom-sp-menu-close-icon" className="h-5 w-5" aria-hidden /> : <Menu id="header-custom-sp-menu-open-icon" className="h-5 w-5" aria-hidden />}
  </Button>
);
