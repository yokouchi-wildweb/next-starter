import { Menu, X } from "lucide-react";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";

export type NavigationToggleButtonProps = {
  readonly isMenuOpen: boolean;
  readonly onToggle: () => void;
};

// 部位の印(data-slot の header-nav)は display: contents の包みに付ける(shadcn の Button が自分で持つ data-slot の button を上書きしない。
// 包みは箱を作らないので並びは変わらず、隠す CSS が包みを display: none にすると中のボタンも消える)
export const SpNavSwitch = ({ isMenuOpen, onToggle }: NavigationToggleButtonProps) => (
  <Block data-slot="header-nav" className="contents">
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="sm:hidden"
      aria-label="メニューを開閉"
      aria-expanded={isMenuOpen}
      onClick={onToggle}
    >
      {isMenuOpen ? (
        <X className="h-5 w-5" aria-hidden />
      ) : (
        <Menu className="h-5 w-5" aria-hidden />
      )}
    </Button>
  </Block>
);
