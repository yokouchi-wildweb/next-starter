// src/features/core/user/components/common/RichMenuCard.tsx

"use client";

import { Link } from "@/components/Navigation/Link";
import type { LucideIcon } from "lucide-react";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";

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
    iconColor: "text-destructive-text",
    title: "text-destructive-text",
    description: "text-destructive-text/70",
    chevron: "text-destructive-text/50",
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

  // アイコンは size-5(= h-5 w-5)。Form/Button は size- の無い svg を size-4 にするので、ボタンの時も同じ大きさにする
  const content = (
    <>
      <Flex align="center" className="gap-3">
        <Flex align="center" justify="center" className={cn("h-10 w-10 rounded-full", styles.iconBg)}>
          <Icon className={cn("size-5", styles.iconColor)} />
        </Flex>
        <Block>
          <Para size="sm" weight="medium" align="inherit" className={cn("my-0", styles.title)}>{title}</Para>
          <Para size="xs" weight="normal" align="inherit" className={cn("my-0", styles.description)}>{description}</Para>
        </Block>
      </Flex>
      {showChevron && <ChevronRightIcon className={cn("size-5", styles.chevron)} />}
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
    // Form/Button の既定(中央寄せ・折り返しなし)は元の button に無いので打ち消す。クリックは元どおり親へ伝える
    <Button
      type="button"
      variant="none"
      size="none"
      propagateClick
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(baseClassName, !showChevron && "justify-start", "whitespace-normal")}
    >
      {content}
    </Button>
  );
}
