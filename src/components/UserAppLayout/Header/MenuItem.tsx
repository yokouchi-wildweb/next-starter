// src/components/UserAppLayout/Header/MenuItem.tsx

import Link from "next/link";

import { Button } from "@/components/Form/Button/Button";

export type NavigationMenuItem = {
  readonly key: string;
  readonly label: string;
  readonly href?: string | null;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
};

export type NavigationItemProps = {
  readonly item: NavigationMenuItem;
  readonly variant: "desktop" | "mobile";
  readonly onNavigate?: () => void;
};
const psClassName = {
  action:
    "h-auto rounded-none px-0 py-0 text-left text-foreground transition-colors hover:bg-transparent hover:text-primary disabled:opacity-60",
  link: "transition-colors hover:text-primary",
} as const;

const spClassName = {
  action:
    "h-auto w-full justify-start px-3 py-2 text-left transition-colors hover:bg-muted hover:text-primary disabled:opacity-60",
  link: "block rounded-md px-3 py-2 transition-colors hover:bg-muted hover:text-primary",
} as const;

export const MenuItem = ({ item, variant, onNavigate }: NavigationItemProps) => {
  const isActionItem = typeof item.onClick === "function";
  const classNameMap = variant === "desktop" ? psClassName : spClassName;

  if (!isActionItem) {
    const href = item.href ?? undefined;
    const className = classNameMap.link;

    if (href == null || href === "") {
      return <span className={className}>{item.label}</span>;
    }

    return (
      <Link href={href} onClick={onNavigate} className={className}>
        {item.label}
      </Link>
    );
  }

  const handleClick = () => {
    onNavigate?.();
    item.onClick?.();
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={item.disabled}
      variant="ghost"
      className={classNameMap.action}
    >
      {item.label}
    </Button>
  );
};
