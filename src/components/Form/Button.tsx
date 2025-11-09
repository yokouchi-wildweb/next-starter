// src/components/Form/Button.tsx

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Button as ShadcnButton } from "@/components/Shadcn/button";
import { cn } from "@/lib/cn";

const buttonVariants = cva("", {
  variants: {
    variant: {
      // 画面で主なアクションに使う標準のプライマリボタン。
      default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
      // 削除など取り消せない重要な操作向けの強調ボタン。
      destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
      // 低い強調度で背景になじむ枠線付きのボタン。
      outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
      // プライマリと組み合わせる代替のセカンダリボタン。
      secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      // ホバー表現は残しつつ主張を抑えた三次的アクション用ボタン。
      ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
      // プロモーションなど目立たせたいアクション向けのアクセント色ボタン。
      accent: "bg-accent text-accent-foreground shadow-lg hover:bg-accent/90 focus-visible:ring-accent/30 dark:focus-visible:ring-accent/50",
      // ツールバーなどで使うアイコンのみの控えめなボタン。
      mutedIcon: "text-muted-foreground hover:text-foreground",
    },
    size: {
      // 標準サイズ。
      default: "h-9 px-4 py-2 has-[>svg]:px-3",
      // 少し小さめのコンパクトサイズ。
      sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
      // 余裕を持たせた大きめサイズ。
      lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
      // アイコンのみで使う正方形サイズ。
      icon: "size-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

type ButtonProps = React.ComponentPropsWithoutRef<typeof ShadcnButton> & VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return (
    <ShadcnButton
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "FormButton";

export { Button, buttonVariants };
