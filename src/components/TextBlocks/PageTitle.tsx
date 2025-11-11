import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

const pageTitleVariants = cva("", {
  variants: {
    variant: {
      // standard: ベーシックなページタイトル。
      standard: "text-2xl font-bold",
      // prominent: ヒーローなど強調したいページタイトル。
      prominent: "text-3xl font-bold",
      // accent: ブランドカラーでアクセントを付けるタイトル。
      accent: "text-2xl font-bold text-primary",
      // showcase: デモページ向けにやや装飾を効かせたタイトル。
      showcase: "text-3xl font-semibold tracking-tight",
      // srOnly: 画面には非表示だがスクリーンリーダー向けに残す用途。
      srOnly: "sr-only",
    },
  },
  defaultVariants: {
    variant: "standard",
  },
});

export type PageTitleProps = ComponentPropsWithoutRef<"h1"> &
  VariantProps<typeof pageTitleVariants> & { children: ReactNode };

export function PageTitle({ variant, className, children, ...props }: PageTitleProps) {
  return (
    <h1 className={cn(pageTitleVariants({ variant }), className)} {...props}>
      {children}
    </h1>
  );
}
