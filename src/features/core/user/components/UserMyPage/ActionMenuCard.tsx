// src/features/core/user/components/UserMyPage/ActionMenuCard.tsx

"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type ActionMenuCardBaseProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: "default" | "muted" | "destructive";
};

type ActionMenuCardLinkProps = ActionMenuCardBaseProps & {
  href: string;
  onClick?: never;
  disabled?: never;
};

type ActionMenuCardButtonProps = ActionMenuCardBaseProps & {
  href?: never;
  onClick: () => void;
  disabled?: boolean;
};

type ActionMenuCardProps = ActionMenuCardLinkProps | ActionMenuCardButtonProps;

const variantStyles = {
  default: "border-border hover:bg-accent/50",
  muted: "border-border text-muted-foreground hover:bg-accent/50",
  destructive: "border-destructive/30 text-destructive hover:bg-destructive/5",
};

export function ActionMenuCard({
  icon: Icon,
  title,
  description,
  variant = "default",
  ...props
}: ActionMenuCardProps) {
  const baseClassName = cn(
    "flex items-start gap-3 rounded-lg border px-4 py-2 transition-colors cursor-pointer sm:p-4",
    variantStyles[variant],
    "disabled" in props && props.disabled && "opacity-50 cursor-not-allowed"
  );

  const content = (
    <>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className={cn("text-sm", variant === "default" ? "text-muted-foreground" : "opacity-70")}>
          {description}
        </p>
      </div>
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
      className={cn(baseClassName, "w-full text-left")}
    >
      {content}
    </button>
  );
}
