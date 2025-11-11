import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";

import type { NavItem } from "./types";

export type NavigationItemProps = {
  readonly item: NavItem;
  readonly variant: "desktop" | "mobile";
  readonly onNavigate?: () => void;
};

const desktopClassNames: Record<NavItem["type"], string> = {
  action:
    "h-auto rounded-none px-0 py-0 text-left text-foreground transition-colors hover:bg-transparent hover:text-primary disabled:opacity-60",
  dummy: "cursor-not-allowed text-muted-foreground",
  link: "transition-colors hover:text-primary",
};

const mobileClassNames: Record<NavItem["type"], string> = {
  action:
    "h-auto w-full justify-start px-3 py-2 text-left transition-colors hover:bg-muted hover:text-primary disabled:opacity-60",
  dummy: "block rounded-md px-3 py-2 text-muted-foreground",
  link: "block rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-primary",
};

export const NavigationItem = ({ item, variant, onNavigate }: NavigationItemProps) => {
  const handleClick = () => {
    onNavigate?.();

    if (item.type === "action") {
      item.onClick();
    }
  };

  if (item.type === "link") {
    const className = variant === "desktop" ? desktopClassNames.link : mobileClassNames.link;

    return (
      <Link key={item.key} href={item.href} onClick={onNavigate} className={className}>
        {item.label}
      </Link>
    );
  }

  if (item.type === "dummy") {
    const className = variant === "desktop" ? desktopClassNames.dummy : mobileClassNames.dummy;

    return (
      <span key={item.key} className={className} aria-disabled={true}>
        {item.label}
      </span>
    );
  }

  const className = variant === "desktop" ? desktopClassNames.action : mobileClassNames.action;

  return (
    <Button
      key={item.key}
      type="button"
      onClick={handleClick}
      disabled={item.disabled}
      variant="ghost"
      className={className}
    >
      {item.label}
    </Button>
  );
};
