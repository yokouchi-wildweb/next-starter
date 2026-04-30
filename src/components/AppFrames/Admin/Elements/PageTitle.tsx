// src/components/Admin/Elements/PageTitle.tsx

import type { ReactNode } from "react";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

import { PageTitle as DefaultPageTitle, type PageTitleProps } from "@/components/TextBlocks";

import { AdminHeaderPortal } from "./AdminHeaderPortal";

const marginBottomClassMap = {
  xs: "mb-2",
  sm: "mb-5",
  md: "mb-8",
  lg: "mb-10",
  xl: "mb-14",
} as const;

const adminPageTitleVariants = cva(
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

export type AdminPageTitleProps = PageTitleProps &
  VariantProps<typeof adminPageTitleVariants> & {
    /**
     * タイトルの表示位置を指定します。
     * - "page": ページ本文上部に大見出しとして表示（デフォルト）
     * - "header": 管理画面ヘッダーのロゴ右隣に圧縮表示。
     *   モバイル（sm 未満）では自動的にページ内表示にフォールバックします。
     */
    placement?: "page" | "header";
  };

export default function PageTitle({
  variant,
  marginBottom,
  className,
  size,
  placement = "page",
  children,
  ...props
}: AdminPageTitleProps) {
  const resolvedSize = size ?? "xxl";
  const responsiveSizeClass = size ? undefined : "sm:text-3xl";

  // placement="header" の時、ページ内描画はモバイル限定（sm 以上は非表示）
  const placementVisibilityClass =
    placement === "header" ? "sm:hidden" : undefined;

  const pageBody = (
    <DefaultPageTitle
      weight="normal"
      size={resolvedSize}
      className={cn(
        adminPageTitleVariants({ variant, marginBottom }),
        responsiveSizeClass,
        placementVisibilityClass,
        className,
      )}
      {...props}
    >
      {children}
    </DefaultPageTitle>
  );

  if (placement === "page") {
    return pageBody;
  }

  return (
    <>
      {pageBody}
      <AdminHeaderPortal slot="title">
        <CompactHeaderTitle>{children}</CompactHeaderTitle>
      </AdminHeaderPortal>
    </>
  );
}

/**
 * ヘッダー埋め込み用の圧縮版ページタイトル。
 * 既存 PageTitle のオレンジバー意匠（文字左下の短い primary バー）を継承する。
 * truncate は内側 span に閉じ込めて、装飾バーが overflow で切れないようにする。
 */
function CompactHeaderTitle({ children }: { children: ReactNode }) {
  const titleAttr = typeof children === "string" ? children : undefined;

  return (
    <h1
      title={titleAttr}
      className={cn(
        "relative",
        "text-base font-semibold tracking-tight text-foreground sm:text-lg",
        "after:absolute after:-bottom-1 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-primary after:content-['']",
        "animate-in fade-in slide-in-from-left-2 duration-200",
      )}
    >
      <span className="block max-w-[40vw] truncate">{children}</span>
    </h1>
  );
}
