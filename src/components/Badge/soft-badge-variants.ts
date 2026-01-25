// src/components/Badge/soft-badge-variants.ts

import { cva, type VariantProps } from "class-variance-authority";

export const softBadgeVariants = cva(
  "relative inline-flex items-center justify-center rounded-full border font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none transition-[color,box-shadow]",
  {
    variants: {
      variant: {
        // 標準のプライマリバッジ
        primary:
          "bg-primary/10 border-primary text-primary",
        // 補助情報向けのセカンダリバッジ
        secondary:
          "bg-secondary/10 border-secondary text-secondary",
        // エラーや削除など警告を示すバッジ
        destructive:
          "bg-destructive/10 border-destructive text-destructive",
        // 成功・完了・有効を示すバッジ
        success:
          "bg-success/10 border-success text-success",
        // 情報・通知を示す青系バッジ
        info:
          "bg-info/10 border-info text-info",
        // 注意・警告を示すアンバー系バッジ
        warning:
          "bg-warning/10 border-warning text-warning",
        // 強調・注目を引くアクセントバッジ
        accent:
          "bg-accent/10 border-accent text-accent",
        // 非アクティブ・下書きなど控えめな状態を示すバッジ
        muted:
          "bg-muted border-muted-foreground/30 text-muted-foreground",
        // 枠線のみのシンプルなバッジ
        outline:
          "bg-transparent border-border text-foreground",
        // 透明背景のゴーストバッジ
        ghost:
          "bg-transparent border-transparent text-foreground",
      },
      size: {
        // コンパクトUI向けの小サイズ
        sm: "px-2.5 py-1 text-xs gap-1 [&>svg]:size-3",
        // 標準サイズ
        md: "px-3 py-1 text-sm gap-1.5 [&>svg]:size-4",
        // 強調表示向けの大サイズ
        lg: "px-4 py-1.5 text-base gap-2 [&>svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type SoftBadgeVariantProps = VariantProps<typeof softBadgeVariants>;
