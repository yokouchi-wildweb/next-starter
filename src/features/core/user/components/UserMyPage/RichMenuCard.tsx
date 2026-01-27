// src/features/core/user/components/UserMyPage/RichMenuCard.tsx

"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type RichMenuCardBaseProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: "default" | "muted" | "destructive";
  showChevron?: boolean;
};

type RichMenuCardLinkProps = RichMenuCardBaseProps & {
  href: string;
  onClick?: never;
  disabled?: never;
};

type RichMenuCardButtonProps = RichMenuCardBaseProps & {
  href?: never;
  onClick: () => void;
  disabled?: boolean;
};

type RichMenuCardProps = RichMenuCardLinkProps | RichMenuCardButtonProps;

const variantStyles = {
  default: {
    card: "border-border hover:bg-muted/50",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "text-foreground",
    description: "text-muted-foreground",
    chevron: "text-muted-foreground",
  },
  muted: {
    card: "border-border hover:bg-muted/50",
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    title: "text-muted-foreground",
    description: "text-muted-foreground",
    chevron: "text-muted-foreground",
  },
  destructive: {
    card: "border-destructive/30 hover:bg-destructive/5",
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    title: "text-destructive",
    description: "text-destructive/70",
    chevron: "text-destructive/50",
  },
};

export function RichMenuCard({
  icon: Icon,
  title,
  description,
  variant = "default",
  showChevron = false,
  ...props
}: RichMenuCardProps) {
  const styles = variantStyles[variant];
  const isDisabled = "disabled" in props && props.disabled;

  const baseClassName = cn(
    "flex w-full cursor-pointer items-center gap-4 rounded-xl border bg-card px-5 py-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    styles.card,
    showChevron && "justify-between",
    isDisabled && "opacity-50 cursor-not-allowed"
  );

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", styles.iconBg)}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
        <div>
          <p className={cn("text-sm font-medium", styles.title)}>{title}</p>
          <p className={cn("text-xs", styles.description)}>{description}</p>
        </div>
      </div>
      {showChevron && <ChevronRightIcon className={cn("h-5 w-5", styles.chevron)} />}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={baseClassName}
    >
      {content}
    </button>
  );
}
