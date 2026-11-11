// src/app/admin/_layout/AdminPageTitle.tsx

import type { ReactNode } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";
import { PageTitle as DefaultPageTitle, type PageTitleProps } from "@/components/TextBlocks";

const marginBottomClassMap = {
  xs: "mb-2",
  sm: "mb-5",
  md: "mb-8",
  lg: "mb-10",
  xl: "mb-14",
} as const;

/** 管理のページの題の大見出しの見た目(文字の下の短い primary の帯 + 薄いグラデーション) */
export const adminPageTitleVariants = cva(
  "relative px-4 py-2 text-foreground bg-gradient-to-tr from-secondary/15 via-secondary/5 to-transparent dark:from-secondary/30 dark:via-secondary/15 dark:to-transparent after:absolute after:left-4 after:-bottom-1 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-['']",
  {
    variants: {
      variant: {
        default: "",
      },
      marginBottom: marginBottomClassMap,
    },
    defaultVariants: {
      variant: "default",
      marginBottom: "md",
    },
  },
);

export type AdminPageTitleHeadingProps = PageTitleProps & VariantProps<typeof adminPageTitleVariants>;

/** 題の大見出し(h1、印 data-slot="admin-page-title")。size を省くと xxl + sm 以上で text-3xl */
export function AdminPageTitleHeading({ variant, marginBottom, className, size, children, ...props }: AdminPageTitleHeadingProps) {
  return (
    <DefaultPageTitle
      weight="normal"
      size={size ?? "xxl"}
      className={cn(adminPageTitleVariants({ variant, marginBottom }), size ? undefined : "sm:text-3xl", className)}
      {...props}
      slot="admin-page-title"
    >
      {children}
    </DefaultPageTitle>
  );
}

/**
 * AdminPage の title の本文側: ページの題の h1(1 つだけ)。SP は本文の上の大見出し、PC(sm 以上)は見た目から消して
 * 支援技術向けに残す(sm:sr-only。PC で見える題はヘッダーの AdminPageTitleCompact)
 */
export function AdminPageTitleBody({ children }: { readonly children: ReactNode }) {
  return <AdminPageTitleHeading className="sm:sr-only">{children}</AdminPageTitleHeading>;
}

/**
 * ヘッダーの行の題の位置(ロゴの右隣、sm 以上)に出す圧縮の題。見出しではない飾りの文字(aria-hidden。h1 は本文側の 1 つ)。
 * 大見出しの帯の意匠(文字左下の短い primary の帯)を継ぐ。truncate は内側の span に閉じ込めて帯が overflow で切れないようにする
 */
export function AdminPageTitleCompact({ children, as: Tag = "p" }: { readonly children: ReactNode; readonly as?: "p" | "h1" }) {
  const titleAttr = typeof children === "string" ? children : undefined;

  return (
    <Tag
      title={titleAttr}
      aria-hidden={Tag === "p" ? true : undefined}
      className={cn(
        "relative min-w-0",
        "text-base font-semibold tracking-tight text-foreground sm:text-lg",
        "after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-['']",
        "animate-in fade-in slide-in-from-left-2 duration-200",
      )}
    >
      <span className="block max-w-[40vw] truncate">{children}</span>
    </Tag>
  );
}
